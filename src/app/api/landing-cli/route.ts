import { spawn } from 'node:child_process';
import { mkdir, rm, stat, writeFile } from 'node:fs/promises';
import { createHash, randomBytes } from 'node:crypto';
import { isAbsolute, join } from 'node:path';
import { tmpdir } from 'node:os';
import { createClerkClient } from '@clerk/backend';
import { fetchQuery } from 'convex/nextjs';
import { api } from '../../../../convex/_generated/api';
import { hashBridgeApiKey } from '@/lib/request-security';
import { createApiKeyHashed, createNoteWithApiKey, createQuickLinkWithApiKey, listNotesWithApiKey, listQuickLinksByUsername, listQuickLinksWithApiKey, syncMyUserProfile } from '@/lib/notes';
import { runLandingShellCommand } from '@/lib/landing-shell';

const MAX_BODY = 22_000;
const MAX_OUTPUT = 24_000;
const MAX_CONCURRENT = 8;
const TIMEOUT_MS = 7_000;
const SESSION_MAX_AGE = 60 * 60 * 8;
const SESSION_PATTERN = /^[A-Za-z0-9_-]{32}$/;
let running = 0;
const busySessions = new Set<string>();
const demoAccountPromises = new Map<string, Promise<{ apiKey: string; username: string }>>();
const demoNotesPromises = new Map<string, Promise<void>>();
const demoLinksPromises = new Map<string, Promise<void>>();

export const runtime = 'nodejs';

function isSandboxPath(value: string) {
  return !isAbsolute(value) && !value.split(/[\\/]+/).includes('..') && !value.includes('\\');
}

function containsOutsidePath(args: string[]) {
  return args.some((arg) => {
    const candidate = arg.startsWith('--') && arg.includes('=') ? arg.slice(arg.indexOf('=') + 1) : arg;
    return isAbsolute(candidate) || /^[a-z]:[\\/]/i.test(candidate) || candidate.split(/[\\/]+/).includes('..');
  });
}

async function verifyDemoApiKey(apiKey: string) {
  const separator = apiKey.indexOf('.');
  if (separator <= 0) return null;
  return await fetchQuery(api.apiKeys.verifyHashed, {
    prefix: apiKey.slice(0, separator),
    keyHash: hashBridgeApiKey(apiKey),
  });
}

function publicDemoBlockReason(args: string[]) {
  const [rawCommand, rawSubcommand] = args;
  const command = rawCommand?.toLowerCase();
  const subcommand = rawSubcommand?.toLowerCase();
  if (command === 'login' || command === 'self-update' || command === 'mcp') {
    return 'login, self-update, and the mcp server are disabled in the public demo.';
  }
  if (args.some((arg) => /^--?(?:api[-_]?key|endpoint|site[-_]?url)(?:=|$)/i.test(arg))) {
    return 'api keys and custom endpoints are disabled in the public demo.';
  }
  if (containsOutsidePath(args)) {
    return 'file paths must stay inside the temporary cli workspace.';
  }
  if (command === 'publish' && !args.includes('--dry-run')) {
    return 'publishing is disabled in the public demo. try --dry-run to preview a local markdown file.';
  }
  if (command === 'notes' && ['delete', 'restore', 'restore-version', 'invite'].includes(subcommand ?? '')) {
    return 'deleting, restoring, and inviting are disabled in the public demo.';
  }
  if (command === 'links' && subcommand === 'invite') {
    return 'invitations are disabled in the public demo.';
  }
  if (command === 'notifications' && ['open', 'dismiss'].includes(subcommand ?? '')) {
    return 'notification changes are disabled in the public demo.';
  }
  if (command === 'config' && ['set', 'unset', 'reset'].includes(subcommand ?? '')) {
    return 'configuration changes are disabled in the public demo.';
  }
  if (command === 'slug' || command === 'publish') {
    const pathIndex = args.findIndex((arg) => arg === '--path' || arg === '-p');
    const pathValue = pathIndex >= 0 ? args[pathIndex + 1] :
      args.find((arg) => arg.startsWith('--path=') || arg.startsWith('-p='))?.split('=').slice(1).join('=');
    const positional = command === 'publish' && !pathValue
      ? args.slice(1).find((arg) => !arg.startsWith('-'))
      : undefined;
    const candidate = pathValue ?? positional;
    if (candidate && !isSandboxPath(candidate)) {
      return 'file paths must stay inside the temporary cli workspace.';
    }
  }
  if (command === 'config' && ['set', 'unset'].includes(subcommand ?? '')) {
    const key = (args[2] ?? '').replace(/[-_]/g, '').toLowerCase();
    if (['apikey', 'endpoint', 'siteurl'].includes(key)) {
      return 'credential and endpoint settings are disabled in the public demo.';
    }
  }
  return null;
}

async function provisionDemoAccount(sessionId: string): Promise<{ apiKey: string; username: string }> {
  const secretKey = process.env.CLERK_SECRET_KEY;
  if (!secretKey) throw new Error('Bri demo authentication is unavailable.');

  const clerk = createClerkClient({ secretKey });
  const externalId = `bri-public-landing-cli-${sessionId}`;
  const findDemoUser = async () => {
    const users = await clerk.users.getUserList({ externalId: [externalId], limit: 1 });
    return users.data[0] ?? null;
  };

  let user = await findDemoUser();
  if (!user) {
    const username = `bri_demo_${randomBytes(5).toString('hex')}`;
    try {
      user = await clerk.users.createUser({
        externalId,
        username,
        emailAddress: [`${username}@example.com`],
        firstName: 'bri',
        lastName: 'demo',
        publicMetadata: { briLandingDemo: true, briLandingDemoSession: sessionId },
        skipPasswordRequirement: true,
      });
    } catch (createError) {
      // Parallel cold starts can race to provision the same external ID.
      user = await findDemoUser();
      if (!user) {
        const clerkError = createError as { message?: string; status?: number; errors?: Array<{ code?: string; message?: string; longMessage?: string }> };
        const reason = clerkError.errors?.map((item) => item.longMessage || item.message || item.code).filter(Boolean).join('; ')
          || clerkError.message
          || `Clerk request failed (${clerkError.status ?? 'unknown status'})`;
        throw new Error(`Could not provision the Bri demo identity: ${reason}`);
      }
    }
  }

  const username = user.username?.toLowerCase();
  if (!username || user.publicMetadata.briLandingDemo !== true) {
    throw new Error('The Bri demo identity is invalid.');
  }

  const storedKey = user.privateMetadata.briLandingCliApiKey;
  if (typeof storedKey === 'string') {
    const identity = await verifyDemoApiKey(storedKey);
    if (identity?.username.toLowerCase() === username && identity.permissions === 'read_write') {
      return { apiKey: storedKey, username };
    }
  }

  const session = await clerk.sessions.createSession({ userId: user.id });
  try {
    const token = await clerk.sessions.getToken(session.id, 'convex', 300);
    const convexToken = token.jwt;
    await syncMyUserProfile({ token: convexToken, username, displayName: 'bri demo', email: null });

    const prefix = `bri_${randomBytes(6).toString('base64url')}`;
    const apiKey = `${prefix}.${randomBytes(24).toString('base64url')}`;
    await createApiKeyHashed({
      token: convexToken,
      username,
      prefix,
      keyHash: createHash('sha256').update(apiKey).digest('hex'),
      permissions: 'read_write',
      label: 'public landing demo',
    });
    user = await clerk.users.updateUser(user.id, {
      privateMetadata: { ...user.privateMetadata, briLandingCliApiKey: apiKey },
    });
    return { apiKey, username };
  } finally {
    await clerk.sessions.revokeSession(session.id).catch(() => undefined);
  }
}

function getDemoAccount(sessionId: string) {
  let pending = demoAccountPromises.get(sessionId);
  if (!pending) {
    pending = provisionDemoAccount(sessionId).catch((error) => {
      demoAccountPromises.delete(sessionId);
      throw error;
    });
    demoAccountPromises.set(sessionId, pending);
  }
  return pending;
}

async function seedDemoNotes(apiKey: string) {
  let current = await listNotesWithApiKey({ apiKey, state: 'active' });
  if (current.length >= 4) return current;
  const source = await fetch('https://bri.fyi/api/public/notes/egeuysall', { next: { revalidate: 300 } });
  if (!source.ok) return current;
  const payload = await source.json() as { data?: Array<{ slug?: unknown; title?: unknown }> };
  const sourceNotes = (payload.data ?? []).filter((note): note is { slug: string; title: string } => typeof note.slug === 'string' && typeof note.title === 'string').slice(0, 4);
  for (const sourceNote of sourceNotes) {
    if (current.some((note) => note.title.trim().toLowerCase() === sourceNote.title.trim().toLowerCase())) continue;
    const response = await fetch(`https://bri.fyi/api/public/notes/egeuysall/${encodeURIComponent(sourceNote.slug)}`, { next: { revalidate: 300 } });
    if (!response.ok) continue;
    const detail = await response.json() as { data?: { title?: unknown; content?: unknown } };
    const note = detail.data;
    if (typeof note?.title !== 'string' || typeof note.content !== 'string' || note.content.length > 16_000) continue;
    await createNoteWithApiKey({ apiKey, title: note.title, content: note.content, visibility: 'private', expiresInDays: null });
    current = await listNotesWithApiKey({ apiKey, state: 'active' });
  }
  return current;
}

async function ensureDemoNotes(sessionId: string, apiKey: string) {
  if (!demoNotesPromises.has(sessionId)) {
    demoNotesPromises.set(sessionId, seedDemoNotes(apiKey).then(() => undefined).catch((error) => {
      demoNotesPromises.delete(sessionId);
      throw error;
    }));
  }
  await demoNotesPromises.get(sessionId);
  return await listNotesWithApiKey({ apiKey, state: 'active' });
}

async function seedDemoLinks(apiKey: string) {
  if ((await listQuickLinksWithApiKey({ apiKey })).length > 0) return;
  const sourceLinks = await listQuickLinksByUsername({ username: 'egeuysall' });
  for (const link of sourceLinks.slice(0, 10)) {
    try {
      const target = new URL(link.targetUrl);
      if (!['http:', 'https:'].includes(target.protocol)) continue;
      await createQuickLinkWithApiKey({
        apiKey,
        key: link.key,
        targetUrl: target.toString(),
        label: link.label,
      });
    } catch {
      // Skip malformed source links or a key that already exists in this demo session.
    }
  }
}

async function ensureDemoLinks(sessionId: string, apiKey: string) {
  if (!demoLinksPromises.has(sessionId)) {
    demoLinksPromises.set(sessionId, seedDemoLinks(apiKey).then(() => undefined).catch((error) => {
      demoLinksPromises.delete(sessionId);
      throw error;
    }));
  }
  await demoLinksPromises.get(sessionId);
  return await listQuickLinksWithApiKey({ apiKey });
}

export async function GET(request: Request) {
  const sessionId = request.headers.get('x-bri-demo-session') ?? '';
  if (!SESSION_PATTERN.test(sessionId)) return Response.json({ notes: [] }, { headers: { 'Cache-Control': 'no-store' } });
  try {
    const { apiKey } = await getDemoAccount(sessionId);
    const allNotes = await ensureDemoNotes(sessionId, apiKey);
    const demoLinks = await ensureDemoLinks(sessionId, apiKey);
    const unique = [...new Map(allNotes.map((note) => [`${note.title.trim().toLowerCase()}\n${note.content.trim().toLowerCase()}`, note])).values()];
    const links = demoLinks.flatMap((link) => {
      try {
        const target = new URL(link.targetUrl);
        return ['http:', 'https:'].includes(target.protocol)
          ? [{ title: link.label || link.key, href: `/${encodeURIComponent(link.username)}/${encodeURIComponent(link.key)}`, target: target.toString() }]
          : [];
      } catch { return []; }
    }).slice(0, 10);
    const notes = unique.slice(0, 10).map(({ username, slug, title, content }) => ({ username, slug, title, content: content.slice(0, 900), temporary: true }));
    return Response.json({ notes, links }, { headers: { 'Cache-Control': 'no-store' } });
  } catch {
    return Response.json({ notes: [] }, { headers: { 'Cache-Control': 'no-store' } });
  }
}

function runProcess(command: string, args: string[], cwd: string, env: NodeJS.ProcessEnv, stdin = '') {
  return new Promise<{ output: string; code: number | null }>((resolve, reject) => {
    const child = spawn(command, args, { cwd, env, stdio: ['pipe', 'pipe', 'pipe'] });
    const chunks: Buffer[] = [];
    let size = 0;
    let timedOut = false;
    const timer = setTimeout(() => {
      timedOut = true;
      child.kill('SIGKILL');
    }, TIMEOUT_MS);
    child.stdout.on('data', append);
    child.stderr.on('data', append);
    child.once('error', (error) => {
      clearTimeout(timer);
      reject(error);
    });
    child.once('close', (code) => {
      clearTimeout(timer);
      const output = Buffer.concat(chunks).toString('utf8').trim();
      resolve({
        output: timedOut ? `${output}\ncommand timed out after ${TIMEOUT_MS / 1000} seconds.`.trim() : output,
        code,
      });
    });
    child.stdin.end(stdin);

    function append(chunk: Buffer) {
      if (size >= MAX_OUTPUT) return;
      const remaining = MAX_OUTPUT - size;
      const bounded = chunk.subarray(0, remaining);
      chunks.push(bounded);
      size += bounded.length;
      if (bounded.length < chunk.length) child.kill('SIGKILL');
    }
  });
}

export async function POST(request: Request) {
  const rawBody = await request.text();
  if (rawBody.length > MAX_BODY) {
    return Response.json({ error: 'Command is too large.' }, { status: 413 });
  }

  let body: unknown;
  try {
    body = JSON.parse(rawBody);
  } catch {
    return Response.json({ error: 'Send a valid JSON command.' }, { status: 400 });
  }

  const rawArgs = (body as { args?: unknown } | null)?.args;
  if (!Array.isArray(rawArgs) || rawArgs.length > 48 ||
      rawArgs.some((arg) => typeof arg !== 'string' || arg.length > 1_000 || arg.includes('\0'))) {
    return Response.json({ error: 'Provide a valid bri command.' }, { status: 400 });
  }

  const args = rawArgs as string[];
  const stdin = (body as { stdin?: unknown }).stdin;
  if (stdin !== undefined && (typeof stdin !== 'string' || stdin.length > 16_000 || stdin.includes('\0'))) {
    return Response.json({ error: 'The piped input must be plain text under 16 kb.' }, { status: 400 });
  }
  const isBriCommand = args[0]?.toLowerCase() === 'bri';
  const cliArgs = isBriCommand ? args.slice(1) : args;
  if (cliArgs.length === 0) cliArgs.push('--help');

  const requestedSession = request.headers.get('x-bri-demo-session');
  const sessionId = requestedSession && SESSION_PATTERN.test(requestedSession) ? requestedSession : randomBytes(24).toString('base64url');
  if (busySessions.has(sessionId)) return Response.json({ error: 'this terminal is already running a command.' }, { status: 429 });
  if (running >= MAX_CONCURRENT) {
    return Response.json({ error: 'The public CLI is busy. Try again shortly.' }, { status: 429 });
  }

  running += 1;
  busySessions.add(sessionId);
  const home = join(tmpdir(), 'bri-cli-demo-workspaces', sessionId);
  try {
    const previous = await stat(home).catch(() => null);
    if (previous && Date.now() - previous.mtimeMs > SESSION_MAX_AGE * 1000) {
      await rm(home, { recursive: true, force: true });
    }
    await mkdir(home, { recursive: true, mode: 0o700 });
    const localOrigin = new URL(request.url).origin;
    const siteUrl = process.env.NODE_ENV === 'development'
      ? localOrigin
      : (process.env.NEXT_PUBLIC_SITE_URL ?? 'https://bri.fyi').replace(/\/+$/, '');

    if (!isBriCommand) {
      const output = await runLandingShellCommand(cliArgs, home, siteUrl);
      return sendResult(request, sessionId, { output: output ?? '' });
    }

    const blockReason = publicDemoBlockReason(cliArgs);
    if (blockReason) return sendResult(request, sessionId, { output: blockReason });
    if (stdin !== undefined && !(cliArgs[0]?.toLowerCase() === 'notes' && cliArgs[1]?.toLowerCase() === 'update' && cliArgs.includes('--stdin'))) {
      return sendResult(request, sessionId, { output: 'piped input is enabled for bri notes update <id> --stdin.' });
    }

    let demoApiKey: string;
    try {
      ({ apiKey: demoApiKey } = await getDemoAccount(sessionId));
    } catch (error) {
      console.error('[landing-cli] demo workspace initialization failed:', error);
      return sendResult(request, sessionId, { output: 'the bri demo workspace could not be initialized. try again shortly.' });
    }

    const demoNotes = await ensureDemoNotes(sessionId, demoApiKey);
    await ensureDemoLinks(sessionId, demoApiKey);
    const notePath = join(home, 'demo-note.md');
    if (demoNotes[0] && !await stat(notePath).then(() => true, () => false)) {
      await writeFile(notePath, `# ${demoNotes[0].title}\n\n${demoNotes[0].content}\n`, { mode: 0o600, flag: 'wx' }).catch(() => undefined);
    }

    const production = process.env.NODE_ENV === 'production';
    const cliEntry = join(process.cwd(), 'cli', production ? '.demo-runtime/demo-entry.js' : 'demo-entry.ts');
    const cliCommand = production ? process.execPath : (process.env.BUN_PATH || 'bun');
    const cliCommandArgs = production
      ? [cliEntry, ...cliArgs]
      : ['run', cliEntry, ...cliArgs];
    const topLevelOnly = ['--help', '-h', 'help', '--version', '-v', '-V', 'version'];
    if (!topLevelOnly.includes(cliArgs[0] ?? '')) cliCommandArgs.push('--no-update-check');
    const { output, code } = await runProcess(cliCommand, cliCommandArgs, home, {
      NODE_ENV: process.env.NODE_ENV ?? 'production',
      PATH: process.env.PATH ?? '',
      HOME: home,
      XDG_CONFIG_HOME: home,
      FORCE_COLOR: '1',
      TERM: 'xterm-256color',
      BRI_SITE_URL: siteUrl,
      BRI_ENDPOINT: `${siteUrl}/api/notes`,
      BRI_API_KEY: demoApiKey,
    }, typeof stdin === 'string' ? stdin : '');
    return sendResult(request, sessionId, { output: output || (code === 0 ? 'command completed.' : 'command exited without output.') });
  } catch {
    return sendResult(request, sessionId, { output: 'the current bri cli could not start. try again shortly.' });
  } finally {
    running = Math.max(0, running - 1);
    busySessions.delete(sessionId);
  }
}

function sendResult(_request: Request, _sessionId: string, payload: { output: string }) {
  return Response.json(payload, { headers: { 'Cache-Control': 'no-store' } });
}
