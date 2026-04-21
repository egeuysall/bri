#!/usr/bin/env bun

import { spawn, spawnSync } from 'node:child_process';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { safeJsonStringify } from '@vercel/flags';
import { Command, type OptionValueSource } from 'commander';
import { closeFlagsClient, initFlagsClient, resolveCliFlags } from './flags';
import {
  type BriConfig,
  getConfigPath,
  loadConfig,
  saveConfig,
  unsetConfigKey,
  updateConfig,
} from './config';
import { generateSlug } from './slug';
import { checkForUpdates } from './update';

const VERSION = '2.1.0';
const IS_DEV = process.env.NODE_ENV === 'development';
const DEFAULT_SITE_URL = IS_DEV ? 'http://localhost:3000' : 'https://bri.egeuysal.com';
const DEFAULT_API_ENDPOINT = `${DEFAULT_SITE_URL}/api/notes`;
const UPDATE_SOURCE_URL = `${DEFAULT_SITE_URL}/bri-version.json`;
const INSTALL_COMMAND = `curl -fsSL ${DEFAULT_SITE_URL}/install.sh | bash`;
const DEFAULT_TIMEOUT_MS = 10_000;
const DEFAULT_MAX_BYTES = 1_048_576;
const DEFAULT_RETRIES = 2;

const ansi = {
  reset: '\x1b[0m',
  bold: '\x1b[1m',
  dim: '\x1b[2m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
  gray: '\x1b[90m',
};

type Printer = {
  info: (message: string) => void;
  ok: (message: string) => void;
  warn: (message: string) => void;
  error: (message: string) => void;
  line: (message: string) => void;
};

type PublishOptions = {
  path?: string;
  stdin?: boolean;
  title?: string;
  visibility?: 'public' | 'private';
  expireDays?: string;
  apiKey?: string;
  endpoint?: string;
  siteUrl?: string;
  timeout?: string;
  maxBytes?: string;
  retries?: string;
  dryRun?: boolean;
  json?: boolean;
  quiet?: boolean;
  copy: boolean;
  open: boolean;
  color: boolean;
  updateCheck: boolean;
};

type SlugOptions = {
  path?: string;
  stdin?: boolean;
  maxBytes?: string;
  json?: boolean;
  color: boolean;
  updateCheck: boolean;
};

type DoctorOptions = {
  endpoint?: string;
  color: boolean;
  json?: boolean;
  updateCheck: boolean;
};

type LoginOptions = {
  apiKey?: string;
  username?: string;
};

type NotesListOptions = {
  state?: 'active' | 'deleted';
  endpoint?: string;
  json?: boolean;
  color: boolean;
};

type NotesReadOptions = {
  endpoint?: string;
  json?: boolean;
  color: boolean;
};

type NotesUpdateOptions = {
  path?: string;
  stdin?: boolean;
  title?: string;
  visibility?: 'public' | 'private';
  expireDays?: string;
  maxBytes?: string;
  endpoint?: string;
  json?: boolean;
  color: boolean;
};

type NotesDeleteOptions = {
  permanent?: boolean;
  endpoint?: string;
  json?: boolean;
  color: boolean;
};

type LinksListOptions = {
  endpoint?: string;
  json?: boolean;
  color: boolean;
};

type LinksCreateOptions = {
  key?: string;
  target?: string;
  label?: string;
  endpoint?: string;
  json?: boolean;
  color: boolean;
};

type LinksUpdateOptions = {
  key?: string;
  target?: string;
  label?: string;
  endpoint?: string;
  json?: boolean;
  color: boolean;
};

type LinksDeleteOptions = {
  endpoint?: string;
  json?: boolean;
  color: boolean;
};

type ConfigOptions = {
  json?: boolean;
};

type ConfigKey = keyof BriConfig;

const CONFIG_KEYS: ConfigKey[] = [
  'endpoint',
  'siteUrl',
  'apiKey',
  'username',
  'timeoutMs',
  'maxBytes',
  'retries',
  'copy',
  'open',
  'color',
];

function colorize(text: string, code: string, enabled: boolean): string {
  if (!enabled) {
    return text;
  }

  return `${code}${text}${ansi.reset}`;
}

function createPrinter(enableColor: boolean, quiet: boolean): Printer {
  const infoPrefix = colorize('[info]', ansi.blue, enableColor);
  const okPrefix = colorize('[ok]', ansi.green, enableColor);
  const warnPrefix = colorize('[warn]', ansi.yellow, enableColor);
  const errorPrefix = colorize('[error]', ansi.red, enableColor);

  return {
    info(message: string) {
      if (!quiet) {
        console.log(`${infoPrefix} ${message}`);
      }
    },
    ok(message: string) {
      console.log(`${okPrefix} ${message}`);
    },
    warn(message: string) {
      console.log(`${warnPrefix} ${message}`);
    },
    error(message: string) {
      console.error(`${errorPrefix} ${message}`);
    },
    line(message: string) {
      console.log(message);
    },
  };
}

function renderPublishOutput(input: {
  enableColor: boolean;
  dryRun: boolean;
  source: string;
  slug: string;
  url: string;
}): void {
  const slugValue = colorize(input.slug, ansi.green, input.enableColor);
  const urlValue = colorize(input.url, ansi.cyan, input.enableColor);
  const modeLabel = input.dryRun ? 'dry-run' : 'published';

  console.log(`mode: ${modeLabel}`);
  console.log(`source: ${input.source}`);
  console.log(`slug: ${slugValue}`);
  console.log(`url: ${urlValue}`);
}

function renderTopHelp(enableColor: boolean): void {
  const title = colorize('bri', ansi.bold, enableColor);
  const usage = colorize('bri [command] [options]', ansi.cyan, enableColor);

  console.log(`${title}  markdown publishing CLI`);
  console.log(`Usage: ${usage}`);
  console.log('');
  console.log('Commands:');
  console.log('  publish   publish markdown to bri');
  console.log('  notes     notes CRUD (list/read/update/delete)');
  console.log('  links     quick links CRUD (list/create/update/delete)');
  console.log('  login     save api key');
  console.log('  logout    remove api key');
  console.log('  slug      generate slug from markdown');
  console.log('  doctor    runtime and endpoint checks');
  console.log('  config    manage local defaults');
  console.log('');
  console.log('Quick start:');
  console.log('  bri -p ./post.md');
  console.log('  bri publish --path ./post.md --dry-run');
  console.log('  cat post.md | bri publish --stdin');
  console.log('');
  console.log('Help:');
  console.log('  bri publish --help');
  console.log('  bri config --help');
}

function getOptionSource(command: Command, key: string): OptionValueSource | undefined {
  try {
    return command.getOptionValueSource(key);
  } catch {
    return undefined;
  }
}

function optionProvidedByCli(command: Command, key: string): boolean {
  return getOptionSource(command, key) === 'cli';
}

function parsePositiveInt(raw: string | undefined, label: string): number {
  if (typeof raw !== 'string') {
    throw new Error(`${label} is required`);
  }

  const parsed = Number.parseInt(raw, 10);

  if (!Number.isFinite(parsed) || parsed <= 0) {
    throw new Error(`${label} must be a positive integer`);
  }

  return parsed;
}

function parseOptionalPositiveInt(raw: string | undefined): number | undefined {
  if (typeof raw !== 'string') {
    return undefined;
  }

  const parsed = Number.parseInt(raw, 10);

  if (!Number.isFinite(parsed) || parsed <= 0) {
    return undefined;
  }

  return parsed;
}

function parseOptionalBoolean(raw: string | undefined): boolean | undefined {
  if (typeof raw !== 'string') {
    return undefined;
  }

  const normalized = raw.trim().toLowerCase();

  if (['1', 'true', 'yes', 'on'].includes(normalized)) {
    return true;
  }

  if (['0', 'false', 'no', 'off'].includes(normalized)) {
    return false;
  }

  return undefined;
}

function isLocalHost(hostname: string): boolean {
  return hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '::1';
}

function validateUrl(raw: string, label: string): URL {
  let parsed: URL;

  try {
    parsed = new URL(raw);
  } catch {
    throw new Error(`${label} is not a valid URL`);
  }

  const secure = parsed.protocol === 'https:';
  const localHttp = parsed.protocol === 'http:' && isLocalHost(parsed.hostname);

  if (!secure && !localHttp) {
    throw new Error(`${label} must use https (http allowed only for localhost)`);
  }

  return parsed;
}

function parseTitleFromMarkdown(content: string): string {
  const lines = content.split('\n');
  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed.startsWith('# ')) {
      return trimmed.slice(2).trim();
    }
  }
  return '';
}

function parseVisibility(raw: string | undefined): 'public' | 'private' {
  return raw === 'private' ? 'private' : 'public';
}

async function readMarkdownFile(
  filePath: string,
  maxBytes: number
): Promise<{ content: string; absolutePath: string }> {
  const absolutePath = path.resolve(filePath);
  const stat = await fs.stat(absolutePath);

  if (!stat.isFile()) {
    throw new Error(`path is not a file: ${absolutePath}`);
  }

  if (stat.size > maxBytes) {
    throw new Error(`file too large (${stat.size} bytes), max ${maxBytes}`);
  }

  const content = await fs.readFile(absolutePath, 'utf8');

  if (content.trim().length === 0) {
    throw new Error('file is empty or whitespace-only');
  }

  return { content, absolutePath };
}

async function readMarkdownStdin(maxBytes: number): Promise<string> {
  if (process.stdin.isTTY) {
    throw new Error('stdin is empty. pass --path or pipe content with --stdin');
  }

  const chunks: Buffer[] = [];
  let total = 0;

  for await (const chunk of process.stdin) {
    const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(String(chunk));
    total += buffer.length;

    if (total > maxBytes) {
      throw new Error(`stdin payload too large (${total} bytes), max ${maxBytes}`);
    }

    chunks.push(buffer);
  }

  const content = Buffer.concat(chunks).toString('utf8');

  if (content.trim().length === 0) {
    throw new Error('stdin content is empty or whitespace-only');
  }

  return content;
}

function hasBinary(command: string): boolean {
  const result = spawnSync(command, ['--version'], { stdio: 'ignore' });
  return result.status === 0;
}

function copyToClipboard(value: string): boolean {
  const platform = process.platform;

  if (platform === 'darwin') {
    return spawnSync('pbcopy', [], { input: value, encoding: 'utf8' }).status === 0;
  }

  if (platform === 'linux') {
    const candidates: Array<[string, string[]]> = [
      ['wl-copy', []],
      ['xclip', ['-selection', 'clipboard']],
      ['xsel', ['--clipboard', '--input']],
    ];

    for (const [cmd, args] of candidates) {
      if (!hasBinary(cmd)) {
        continue;
      }

      const result = spawnSync(cmd, args, { input: value, encoding: 'utf8' });
      if (result.status === 0) {
        return true;
      }
    }

    return false;
  }

  if (platform === 'win32') {
    return spawnSync('clip', [], { input: value, encoding: 'utf8', shell: true }).status === 0;
  }

  return false;
}

function openInBrowser(url: string): boolean {
  const platform = process.platform;

  try {
    if (platform === 'darwin') {
      spawn('open', [url], { stdio: 'ignore', detached: true }).unref();
      return true;
    }

    if (platform === 'linux') {
      spawn('xdg-open', [url], { stdio: 'ignore', detached: true }).unref();
      return true;
    }

    if (platform === 'win32') {
      spawn('cmd', ['/c', 'start', '', url], { stdio: 'ignore', detached: true }).unref();
      return true;
    }
  } catch {
    return false;
  }

  return false;
}

function wait(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function publishMarkdown(input: {
  endpoint: URL;
  apiKey: string;
  title: string;
  visibility: 'public' | 'private';
  expiresInDays: number | null;
  content: string;
  timeoutMs: number;
  retries: number;
}): Promise<{ slug: string; username: string; elapsedMs: number; statusCode: number }> {
  const payload = safeJsonStringify({
    title: input.title,
    content: input.content,
    visibility: input.visibility,
    expiresInDays: input.expiresInDays,
  });

  const start = Date.now();
  let lastError: Error | null = null;

  for (let attempt = 0; attempt <= input.retries; attempt += 1) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), input.timeoutMs);

    try {
      const response = await fetch(input.endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'User-Agent': `bri/${VERSION}`,
          Authorization: `Bearer ${input.apiKey}`,
        },
        body: payload,
        signal: controller.signal,
      });

      const responseText = await response.text();

      if (!response.ok) {
        if (response.status >= 500 && attempt < input.retries) {
          await wait(250 * (attempt + 1));
          continue;
        }

        throw new Error(`server returned ${response.status}: ${responseText}`);
      }

      const parsed = JSON.parse(responseText) as {
        data?: { slug?: unknown; username?: unknown };
      };
      const resolvedSlug = parsed?.data?.slug;
      const resolvedUsername = parsed?.data?.username;

      if (typeof resolvedSlug !== 'string' || !resolvedSlug.trim()) {
        throw new Error('server response missing data.slug');
      }
      if (typeof resolvedUsername !== 'string' || !resolvedUsername.trim()) {
        throw new Error('server response missing data.username');
      }

      return {
        slug: resolvedSlug,
        username: resolvedUsername,
        elapsedMs: Date.now() - start,
        statusCode: response.status,
      };
    } catch (error) {
      const normalized = error instanceof Error ? error : new Error(String(error));
      lastError = normalized;

      if (attempt < input.retries) {
        await wait(250 * (attempt + 1));
        continue;
      }
    } finally {
      clearTimeout(timer);
    }
  }

  throw new Error(lastError?.message ?? 'publish failed');
}

async function maybeCheckUpdates(enabled: boolean, printer: Printer): Promise<void> {
  if (!enabled) {
    return;
  }

  const result = await checkForUpdates({
    currentVersion: VERSION,
    sourceUrl: UPDATE_SOURCE_URL,
  });

  if (result.hasUpdate && result.latestVersion) {
    printer.warn(`update available: ${result.latestVersion} (current ${VERSION})`);
    printer.info(`run: ${INSTALL_COMMAND}`);
  }
}

function getStringSetting(
  command: Command,
  key: string,
  cliValue: string | undefined,
  envValue: string | undefined,
  configValue: string | undefined,
  fallback: string
): string {
  if (optionProvidedByCli(command, key)) {
    return cliValue ?? fallback;
  }

  if (typeof envValue === 'string' && envValue.trim()) {
    return envValue;
  }

  if (typeof configValue === 'string' && configValue.trim()) {
    return configValue;
  }

  return fallback;
}

function getNumberSetting(
  command: Command,
  key: string,
  cliValue: string | undefined,
  envValue: string | undefined,
  configValue: number | undefined,
  flagValue: number,
  fallback: number
): number {
  if (optionProvidedByCli(command, key)) {
    return parsePositiveInt(cliValue, key);
  }

  const fromEnv = parseOptionalPositiveInt(envValue);
  if (fromEnv !== undefined) {
    return fromEnv;
  }

  if (typeof configValue === 'number' && Number.isFinite(configValue) && configValue > 0) {
    return Math.floor(configValue);
  }

  if (Number.isFinite(flagValue) && flagValue > 0) {
    return Math.floor(flagValue);
  }

  return fallback;
}

function getBooleanSetting(
  command: Command,
  key: string,
  cliValue: boolean,
  envValue: string | undefined,
  configValue: boolean | undefined,
  flagValue: boolean,
  fallback: boolean
): boolean {
  if (optionProvidedByCli(command, key)) {
    return cliValue;
  }

  const fromEnv = parseOptionalBoolean(envValue);
  if (fromEnv !== undefined) {
    return fromEnv;
  }

  if (typeof configValue === 'boolean') {
    return configValue;
  }

  if (typeof flagValue === 'boolean') {
    return flagValue;
  }

  return fallback;
}

async function runPublish(options: PublishOptions, command: Command): Promise<void> {
  const config = await loadConfig();

  const flagsClient = await initFlagsClient();
  const flagValues = await resolveCliFlags(flagsClient, {
    autoOpen: true,
    autoCopy: true,
    useColor: true,
    retries: DEFAULT_RETRIES,
    timeoutMs: DEFAULT_TIMEOUT_MS,
  });

  const endpointRaw = getStringSetting(
    command,
    'endpoint',
    options.endpoint,
    process.env.BRI_ENDPOINT ?? process.env.BRI_ENDPOINT,
    config.endpoint,
    DEFAULT_API_ENDPOINT
  );

  const siteUrlRaw = getStringSetting(
    command,
    'siteUrl',
    options.siteUrl,
    process.env.BRI_SITE_URL ?? process.env.BRI_SITE_URL,
    config.siteUrl,
    DEFAULT_SITE_URL
  );

  const apiKey = getStringSetting(
    command,
    'apiKey',
    options.apiKey,
    process.env.BRI_API_KEY ?? process.env.BRI_TOKEN,
    config.apiKey,
    ''
  ).trim();

  const timeoutMs = getNumberSetting(
    command,
    'timeout',
    options.timeout,
    process.env.BRI_TIMEOUT_MS ?? process.env.BRI_TIMEOUT_MS,
    config.timeoutMs,
    flagValues.timeoutMs,
    DEFAULT_TIMEOUT_MS
  );

  const maxBytes = getNumberSetting(
    command,
    'maxBytes',
    options.maxBytes,
    process.env.BRI_MAX_BYTES ?? process.env.BRI_MAX_BYTES,
    config.maxBytes,
    DEFAULT_MAX_BYTES,
    DEFAULT_MAX_BYTES
  );

  const retries = getNumberSetting(
    command,
    'retries',
    options.retries,
    process.env.BRI_RETRIES ?? process.env.BRI_RETRIES,
    config.retries,
    flagValues.retries,
    DEFAULT_RETRIES
  );

  const copy = getBooleanSetting(
    command,
    'copy',
    options.copy,
    process.env.BRI_COPY ?? process.env.BRI_COPY,
    config.copy,
    flagValues.autoCopy,
    true
  );

  const open = getBooleanSetting(
    command,
    'open',
    options.open,
    process.env.BRI_OPEN ?? process.env.BRI_OPEN,
    config.open,
    flagValues.autoOpen,
    true
  );

  const color = getBooleanSetting(
    command,
    'color',
    options.color,
    process.env.BRI_COLOR ?? process.env.BRI_COLOR,
    config.color,
    flagValues.useColor,
    process.stdout.isTTY
  );

  const printer = createPrinter(color, Boolean(options.quiet) || Boolean(options.json));

  try {
    await maybeCheckUpdates(options.updateCheck, printer);

    if (!apiKey) {
      throw new Error('missing api key. run `bri login --api-key <key>`');
    }

    const endpoint = validateUrl(endpointRaw, 'endpoint');
    const siteUrl = validateUrl(siteUrlRaw, 'site-url');

    let content = '';
    let sourcePath = options.path;

    if (options.stdin) {
      content = await readMarkdownStdin(maxBytes);
      sourcePath = sourcePath ?? 'stdin.md';
    } else if (options.path) {
      const loaded = await readMarkdownFile(options.path, maxBytes);
      content = loaded.content;
      sourcePath = loaded.absolutePath;
    } else {
      throw new Error('missing input. use --path <file> or --stdin');
    }

    const title = options.title?.trim() || parseTitleFromMarkdown(content);
    if (!title) {
      throw new Error('missing title. pass --title or include markdown H1');
    }
    const visibility = parseVisibility(options.visibility);
    const expireDays = parseOptionalPositiveInt(options.expireDays);
    const expiresInDays = expireDays ? Math.min(30, expireDays) : 30;

    if (options.dryRun) {
      const usernameHint =
        (config.username?.trim() || process.env.BRI_USERNAME?.trim() || '').toLowerCase();
      const dryRunPath = usernameHint ? `/${usernameHint}/<slug-from-title>` : '/<username>/<slug-from-title>';
      const dryRunUrl = new URL(dryRunPath, siteUrl).toString();

      if (options.json) {
        console.log(
          JSON.stringify(
            {
              dryRun: true,
              title,
              visibility,
              expiresInDays,
              url: dryRunUrl,
              source: sourcePath,
            },
            null,
            2
          )
        );
      } else {
        renderPublishOutput({
          enableColor: color,
          dryRun: true,
          source: sourcePath ?? 'stdin.md',
          slug: title,
          url: dryRunUrl,
        });
      }

      return;
    }

    const published = await publishMarkdown({
      endpoint,
      apiKey,
      title,
      visibility,
      expiresInDays,
      content,
      timeoutMs,
      retries,
    });

    const normalizedSlug = published.slug.replace(/^\/+/, '');
    const username = published.username.replace(/^\/+/, '');
    const postUrl = new URL(`/${username}/${normalizedSlug}`, siteUrl).toString();

    if (options.json) {
      console.log(
        JSON.stringify(
          {
            dryRun: false,
            username,
            slug: normalizedSlug,
            url: postUrl,
            elapsedMs: published.elapsedMs,
            statusCode: published.statusCode,
          },
          null,
          2
        )
      );
    } else {
      renderPublishOutput({
        enableColor: color,
        dryRun: false,
        source: sourcePath ?? 'stdin.md',
        slug: normalizedSlug,
        url: postUrl,
      });
    }

    if (!options.json) {
      if (copy) {
        if (!copyToClipboard(postUrl)) {
          printer.warn('clipboard unavailable');
        }
      }

      if (open) {
        if (!openInBrowser(postUrl)) {
          printer.warn('browser open failed');
        }
      }
    }
  } finally {
    await closeFlagsClient(flagsClient);
  }
}

async function fetchWithApiKey(input: {
  endpoint: URL;
  apiKey: string;
  method?: string;
  body?: unknown;
  timeoutMs?: number;
}): Promise<unknown> {
  const controller = new AbortController();
  const timeoutMs = input.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(input.endpoint, {
      method: input.method ?? 'GET',
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': `bri/${VERSION}`,
        Authorization: `Bearer ${input.apiKey}`,
      },
      body: input.body !== undefined ? safeJsonStringify(input.body) : undefined,
      signal: controller.signal,
    });

    const raw = await response.text();
    const parsed = raw ? (JSON.parse(raw) as { data?: unknown; error?: string }) : {};

    if (!response.ok) {
      throw new Error(parsed.error || `request failed (${response.status})`);
    }

    return parsed.data;
  } finally {
    clearTimeout(timer);
  }
}

async function runLogin(options: LoginOptions): Promise<void> {
  const apiKey = options.apiKey?.trim();
  if (!apiKey) throw new Error('missing api key');

  const username = options.username?.trim().toLowerCase();
  await updateConfig({
    apiKey,
    ...(username ? { username } : {}),
  });
  console.log('login saved');
}

async function runLogout(): Promise<void> {
  await unsetConfigKey('apiKey');
  console.log('logged out');
}

async function runNotesList(options: NotesListOptions, command: Command): Promise<void> {
  const config = await loadConfig();
  const endpointRaw = getStringSetting(
    command,
    'endpoint',
    options.endpoint,
    process.env.BRI_ENDPOINT,
    config.endpoint,
    DEFAULT_API_ENDPOINT
  );
  const endpoint = validateUrl(endpointRaw, 'endpoint');
  const apiKey = (config.apiKey || process.env.BRI_API_KEY || '').trim();
  if (!apiKey) throw new Error('missing api key. run `bri login --api-key <key>`');
  const state = options.state === 'deleted' ? 'deleted' : 'active';
  endpoint.searchParams.set('state', state);

  const data = (await fetchWithApiKey({ endpoint, apiKey })) as Array<Record<string, unknown>>;
  if (options.json) {
    console.log(JSON.stringify({ data }, null, 2));
    return;
  }

  const color = optionProvidedByCli(command, 'color') ? options.color : process.stdout.isTTY;
  const printer = createPrinter(color, false);
  if (!Array.isArray(data) || data.length === 0) {
    printer.line('no notes');
    return;
  }

  for (const row of data) {
    const title = typeof row.title === 'string' ? row.title : 'untitled';
    const id = typeof row.id === 'string' ? row.id : '';
    const username = typeof row.username === 'string' ? row.username : '';
    const slug = typeof row.slug === 'string' ? row.slug : '';
    printer.line(`${id}  ${username}/${slug}  ${title}`);
  }
}

async function runNotesRead(username: string, slug: string, options: NotesReadOptions, command: Command) {
  const config = await loadConfig();
  const siteRaw = optionProvidedByCli(command, 'endpoint')
    ? options.endpoint ?? DEFAULT_SITE_URL
    : (process.env.BRI_SITE_URL ?? config.siteUrl ?? DEFAULT_SITE_URL);
  const base = validateUrl(siteRaw, 'site-url');
  const endpoint = new URL(`/api/public/notes/${encodeURIComponent(username)}/${encodeURIComponent(slug)}`, base);
  const apiKey = (config.apiKey || process.env.BRI_API_KEY || '').trim();

  const response = await fetch(endpoint, {
    headers: apiKey ? { Authorization: `Bearer ${apiKey}` } : {},
  });

  const raw = await response.text();
  const parsed = raw ? (JSON.parse(raw) as { data?: unknown; error?: string }) : {};
  if (!response.ok) throw new Error(parsed.error || `request failed (${response.status})`);

  if (options.json) {
    console.log(JSON.stringify(parsed.data ?? {}, null, 2));
    return;
  }

  const data = parsed.data as { title?: string; content?: string };
  console.log(data.title || `${username}/${slug}`);
  console.log('');
  console.log(data.content || '');
}

async function runNotesUpdate(id: string, options: NotesUpdateOptions, command: Command) {
  const config = await loadConfig();
  const apiKey = (config.apiKey || process.env.BRI_API_KEY || '').trim();
  if (!apiKey) throw new Error('missing api key. run `bri login --api-key <key>`');

  const endpointRaw = getStringSetting(
    command,
    'endpoint',
    options.endpoint,
    process.env.BRI_ENDPOINT,
    config.endpoint,
    DEFAULT_API_ENDPOINT
  );

  const baseEndpoint = validateUrl(endpointRaw, 'endpoint');
  const endpoint = new URL(`/api/notes/by-id/${encodeURIComponent(id)}`, baseEndpoint);

  const maxBytes = optionProvidedByCli(command, 'maxBytes')
    ? parsePositiveInt(options.maxBytes, 'max-bytes')
    : DEFAULT_MAX_BYTES;

  let content = '';
  if (options.stdin) {
    content = await readMarkdownStdin(maxBytes);
  } else if (options.path) {
    const loaded = await readMarkdownFile(options.path, maxBytes);
    content = loaded.content;
  } else {
    throw new Error('missing input. use --path or --stdin');
  }

  const title = options.title?.trim() || parseTitleFromMarkdown(content);
  if (!title) throw new Error('missing title. pass --title or include markdown H1');

  const visibility = parseVisibility(options.visibility);
  const expiresInDays = parseOptionalPositiveInt(options.expireDays)
    ? Math.min(30, parseOptionalPositiveInt(options.expireDays) as number)
    : 30;

  const data = await fetchWithApiKey({
    endpoint,
    apiKey,
    method: 'PATCH',
    body: {
      action: 'update',
      title,
      content,
      visibility,
      expiresInDays,
    },
  });

  if (options.json) {
    console.log(JSON.stringify({ data }, null, 2));
    return;
  }
  console.log('updated');
}

async function runNotesDelete(id: string, options: NotesDeleteOptions, command: Command) {
  const config = await loadConfig();
  const apiKey = (config.apiKey || process.env.BRI_API_KEY || '').trim();
  if (!apiKey) throw new Error('missing api key. run `bri login --api-key <key>`');

  const endpointRaw = getStringSetting(
    command,
    'endpoint',
    options.endpoint,
    process.env.BRI_ENDPOINT,
    config.endpoint,
    DEFAULT_API_ENDPOINT
  );
  const baseEndpoint = validateUrl(endpointRaw, 'endpoint');
  const endpoint = new URL(`/api/notes/by-id/${encodeURIComponent(id)}`, baseEndpoint);

  const action = options.permanent ? 'permanentDelete' : 'softDelete';
  const data = await fetchWithApiKey({
    endpoint,
    apiKey,
    method: 'PATCH',
    body: { action },
  });

  if (options.json) {
    console.log(JSON.stringify({ data }, null, 2));
    return;
  }
  console.log(options.permanent ? 'deleted forever' : 'deleted');
}

async function runLinksList(options: LinksListOptions, command: Command) {
  const config = await loadConfig();
  const apiKey = (config.apiKey || process.env.BRI_API_KEY || '').trim();
  if (!apiKey) throw new Error('missing api key. run `bri login --api-key <key>`');

  const endpointRaw = getStringSetting(
    command,
    'endpoint',
    options.endpoint,
    process.env.BRI_ENDPOINT,
    config.endpoint,
    DEFAULT_API_ENDPOINT
  );
  const baseEndpoint = validateUrl(endpointRaw, 'endpoint');
  const endpoint = new URL('/api/quick-links', baseEndpoint);

  const data = (await fetchWithApiKey({ endpoint, apiKey })) as Array<Record<string, unknown>>;
  if (options.json) {
    console.log(JSON.stringify({ data }, null, 2));
    return;
  }

  const color = optionProvidedByCli(command, 'color') ? options.color : process.stdout.isTTY;
  const printer = createPrinter(color, false);
  if (!Array.isArray(data) || data.length === 0) {
    printer.line('no links');
    return;
  }

  for (const row of data) {
    const id = typeof row.id === 'string' ? row.id : '';
    const username = typeof row.username === 'string' ? row.username : '';
    const key = typeof row.key === 'string' ? row.key : '';
    const targetUrl = typeof row.targetUrl === 'string' ? row.targetUrl : '';
    const clicks = typeof row.clicks === 'number' ? row.clicks : 0;
    printer.line(`${id}  ${username}/${key}  ${targetUrl}  clicks:${clicks}`);
  }
}

async function runLinksCreate(options: LinksCreateOptions, command: Command) {
  const config = await loadConfig();
  const apiKey = (config.apiKey || process.env.BRI_API_KEY || '').trim();
  if (!apiKey) throw new Error('missing api key. run `bri login --api-key <key>`');

  const key = options.key?.trim() || '';
  const targetUrl = options.target?.trim() || '';
  if (!key) throw new Error('missing key');
  if (!targetUrl) throw new Error('missing target url');

  const endpointRaw = getStringSetting(
    command,
    'endpoint',
    options.endpoint,
    process.env.BRI_ENDPOINT,
    config.endpoint,
    DEFAULT_API_ENDPOINT
  );
  const baseEndpoint = validateUrl(endpointRaw, 'endpoint');
  const endpoint = new URL('/api/quick-links', baseEndpoint);

  const data = await fetchWithApiKey({
    endpoint,
    apiKey,
    method: 'POST',
    body: {
      key,
      targetUrl,
      label: options.label?.trim() || null,
    },
  });

  if (options.json) {
    console.log(JSON.stringify({ data }, null, 2));
    return;
  }
  console.log('created');
}

async function runLinksUpdate(id: string, options: LinksUpdateOptions, command: Command) {
  const config = await loadConfig();
  const apiKey = (config.apiKey || process.env.BRI_API_KEY || '').trim();
  if (!apiKey) throw new Error('missing api key. run `bri login --api-key <key>`');

  const key = options.key?.trim() || '';
  const targetUrl = options.target?.trim() || '';
  if (!key) throw new Error('missing key');
  if (!targetUrl) throw new Error('missing target url');

  const endpointRaw = getStringSetting(
    command,
    'endpoint',
    options.endpoint,
    process.env.BRI_ENDPOINT,
    config.endpoint,
    DEFAULT_API_ENDPOINT
  );
  const baseEndpoint = validateUrl(endpointRaw, 'endpoint');
  const endpoint = new URL(`/api/quick-links/${encodeURIComponent(id)}`, baseEndpoint);

  const data = await fetchWithApiKey({
    endpoint,
    apiKey,
    method: 'PATCH',
    body: {
      key,
      targetUrl,
      label: options.label?.trim() || null,
    },
  });

  if (options.json) {
    console.log(JSON.stringify({ data }, null, 2));
    return;
  }
  console.log('updated');
}

async function runLinksDelete(id: string, options: LinksDeleteOptions, command: Command) {
  const config = await loadConfig();
  const apiKey = (config.apiKey || process.env.BRI_API_KEY || '').trim();
  if (!apiKey) throw new Error('missing api key. run `bri login --api-key <key>`');

  const endpointRaw = getStringSetting(
    command,
    'endpoint',
    options.endpoint,
    process.env.BRI_ENDPOINT,
    config.endpoint,
    DEFAULT_API_ENDPOINT
  );
  const baseEndpoint = validateUrl(endpointRaw, 'endpoint');
  const endpoint = new URL(`/api/quick-links/${encodeURIComponent(id)}`, baseEndpoint);

  const data = await fetchWithApiKey({
    endpoint,
    apiKey,
    method: 'DELETE',
  });

  if (options.json) {
    console.log(JSON.stringify({ data }, null, 2));
    return;
  }
  console.log('deleted');
}

async function runSlug(options: SlugOptions, command: Command): Promise<void> {
  const maxBytes = optionProvidedByCli(command, 'maxBytes')
    ? parsePositiveInt(options.maxBytes, 'max-bytes')
    : (parseOptionalPositiveInt(process.env.BRI_MAX_BYTES ?? process.env.BRI_MAX_BYTES) ??
      DEFAULT_MAX_BYTES);

  const color = optionProvidedByCli(command, 'color') ? options.color : process.stdout.isTTY;
  const printer = createPrinter(color, Boolean(options.json));

  await maybeCheckUpdates(options.updateCheck, printer);

  let content = '';
  let sourcePath = options.path;

  if (options.stdin) {
    content = await readMarkdownStdin(maxBytes);
    sourcePath = sourcePath ?? 'stdin.md';
  } else if (options.path) {
    const loaded = await readMarkdownFile(options.path, maxBytes);
    content = loaded.content;
    sourcePath = loaded.absolutePath;
  } else {
    throw new Error('missing input. use --path <file> or --stdin');
  }

  const slug = generateSlug(sourcePath, content);

  if (options.json) {
    console.log(JSON.stringify({ slug, source: sourcePath }, null, 2));
  } else {
    printer.line(slug);
  }
}

async function runDoctor(options: DoctorOptions, command: Command): Promise<void> {
  const color = optionProvidedByCli(command, 'color') ? options.color : process.stdout.isTTY;
  const printer = createPrinter(color, Boolean(options.json));

  await maybeCheckUpdates(options.updateCheck, printer);

  const endpointRaw =
    (optionProvidedByCli(command, 'endpoint') ? options.endpoint : undefined) ??
    process.env.BRI_ENDPOINT ??
    process.env.BRI_ENDPOINT ??
    DEFAULT_API_ENDPOINT;

  const checks: Array<{ name: string; ok: boolean; detail: string }> = [];

  checks.push({
    name: 'bun-runtime',
    ok: typeof process.versions.bun === 'string',
    detail: process.versions.bun ? `bun ${process.versions.bun}` : 'bun runtime missing',
  });

  checks.push({
    name: 'config-path',
    ok: true,
    detail: getConfigPath(),
  });

  const flagsPresent = Boolean(
    process.env.FLAGS ?? process.env.FLAGS_SDK_KEY ?? process.env.VERCEL_FLAGS_SDK_KEY
  );
  checks.push({
    name: 'flags-sdk-key',
    ok: flagsPresent,
    detail: flagsPresent ? 'present' : 'missing (optional)',
  });

  try {
    const endpoint = validateUrl(endpointRaw, 'endpoint');
    checks.push({
      name: 'endpoint-url',
      ok: true,
      detail: endpoint.toString(),
    });

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 2500);

    try {
      const response = await fetch(endpoint, {
        method: 'OPTIONS',
        signal: controller.signal,
      });

      checks.push({
        name: 'endpoint-reachable',
        ok: true,
        detail: `status ${response.status}`,
      });
    } catch (error) {
      checks.push({
        name: 'endpoint-reachable',
        ok: false,
        detail: error instanceof Error ? error.message : String(error),
      });
    } finally {
      clearTimeout(timer);
    }
  } catch (error) {
    checks.push({
      name: 'endpoint-url',
      ok: false,
      detail: error instanceof Error ? error.message : String(error),
    });
  }

  const clipboardOk =
    process.platform === 'darwin'
      ? hasBinary('pbcopy')
      : process.platform === 'linux'
        ? hasBinary('wl-copy') || hasBinary('xclip') || hasBinary('xsel')
        : true;

  checks.push({
    name: 'clipboard-tool',
    ok: clipboardOk,
    detail: clipboardOk ? 'available' : 'missing (optional)',
  });

  if (options.json) {
    console.log(JSON.stringify({ checks }, null, 2));
    return;
  }

  for (const item of checks) {
    const prefix = item.ok
      ? colorize('[ok]', ansi.green, color)
      : colorize('[warn]', ansi.yellow, color);
    printer.line(`${prefix} ${item.name}: ${item.detail}`);
  }
}

async function runConfigList(options: ConfigOptions): Promise<void> {
  const config = await loadConfig();

  if (options.json) {
    console.log(JSON.stringify(config, null, 2));
    return;
  }

  const keys = Object.keys(config) as ConfigKey[];

  if (keys.length === 0) {
    console.log('config is empty');
    return;
  }

  for (const key of keys) {
    console.log(`${key}=${String(config[key])}`);
  }
}

function parseConfigValue(key: ConfigKey, raw: string): string | number | boolean {
  switch (key) {
    case 'endpoint':
    case 'siteUrl':
      validateUrl(raw, key);
      return raw;
    case 'apiKey':
    case 'username':
      return raw.trim();
    case 'timeoutMs':
    case 'maxBytes':
    case 'retries':
      return parsePositiveInt(raw, key);
    case 'copy':
    case 'open':
    case 'color': {
      const parsed = parseOptionalBoolean(raw);
      if (parsed === undefined) {
        throw new Error(`${key} must be one of: true,false,1,0,yes,no,on,off`);
      }
      return parsed;
    }
    default:
      throw new Error(`unsupported key: ${key satisfies never}`);
  }
}

async function runConfigSet(key: string, value: string): Promise<void> {
  if (!CONFIG_KEYS.includes(key as ConfigKey)) {
    throw new Error(`unknown key: ${key}`);
  }

  const typedKey = key as ConfigKey;
  const parsedValue = parseConfigValue(typedKey, value);

  await updateConfig({
    [typedKey]: parsedValue,
  });

  console.log(`saved ${typedKey}`);
}

async function runConfigUnset(key: string): Promise<void> {
  if (!CONFIG_KEYS.includes(key as ConfigKey)) {
    throw new Error(`unknown key: ${key}`);
  }

  await unsetConfigKey(key as ConfigKey);
  console.log(`removed ${key}`);
}

async function runConfigReset(): Promise<void> {
  await saveConfig({});
  console.log('config reset');
}

function normalizeArgv(argv: string[]): string[] {
  const passthrough = [...argv];
  const bin = passthrough[0] ?? 'bun';
  const script = passthrough[1] ?? 'bri';
  const first = passthrough[2];

  if (!first) {
    return [bin, script, '--help'];
  }

  const known = new Set([
    'publish',
    'slug',
    'doctor',
    'login',
    'logout',
    'notes',
    'links',
    'config',
    'help',
    '--help',
    '-h',
    '--version',
    '-V',
  ]);

  if (known.has(first)) {
    return passthrough;
  }

  if (first.startsWith('-')) {
    return [bin, script, 'publish', ...passthrough.slice(2)];
  }

  return [bin, script, 'publish', '--path', first, ...passthrough.slice(3)];
}

async function main(): Promise<void> {
  const argv = process.argv.slice(2);
  if (
    argv.length === 0 ||
    (argv.length === 1 && (argv[0] === '-h' || argv[0] === '--help' || argv[0] === 'help'))
  ) {
    renderTopHelp(process.stdout.isTTY);
    return;
  }

  const program = new Command();

  program.name('bri').description('bri CLI: publish markdown to bri').version(VERSION);

  program
    .command('publish')
    .description('publish markdown to bri')
    .option('-p, --path <path>', 'path to markdown file')
    .option('--stdin', 'read markdown from stdin')
    .option('--title <title>', 'note title (falls back to markdown H1)')
    .option('--visibility <visibility>', 'public or private', 'public')
    .option('--expire-days <days>', 'expiration in days (max 30)', '30')
    .option('--api-key <key>', 'api key override')
    .option('--endpoint <url>', 'api endpoint override')
    .option('--site-url <url>', 'site url for final links')
    .option('--timeout <ms>', 'request timeout in milliseconds')
    .option('--max-bytes <bytes>', 'max accepted input bytes')
    .option('--retries <count>', 'retry count for 5xx/network errors')
    .option('--dry-run', 'validate input and print resolved slug/url only')
    .option('--json', 'output machine readable json')
    .option('-q, --quiet', 'reduce non-essential logs')
    .option('--no-copy', 'skip clipboard copy')
    .option('--no-open', 'skip browser open')
    .option('--no-color', 'disable ansi colors')
    .option('--no-update-check', 'skip 24h update check')
    .action(async (_: unknown, command: Command) => {
      const options = command.opts<PublishOptions>();
      await runPublish(options, command);
    });

  program
    .command('slug')
    .description('generate slug from markdown without publishing')
    .option('-p, --path <path>', 'path to markdown file')
    .option('--stdin', 'read markdown from stdin')
    .option('--max-bytes <bytes>', 'max accepted input bytes')
    .option('--json', 'output machine readable json')
    .option('--no-color', 'disable ansi colors')
    .option('--no-update-check', 'skip 24h update check')
    .action(async (_: unknown, command: Command) => {
      const options = command.opts<SlugOptions>();
      await runSlug(options, command);
    });

  program
    .command('doctor')
    .description('run local runtime checks')
    .option('--endpoint <url>', 'api endpoint to probe')
    .option('--json', 'output machine readable json')
    .option('--no-color', 'disable ansi colors')
    .option('--no-update-check', 'skip 24h update check')
    .action(async (_: unknown, command: Command) => {
      const options = command.opts<DoctorOptions>();
      await runDoctor(options, command);
    });

  program
    .command('login')
    .description('store api key for authenticated CLI operations')
    .requiredOption('--api-key <key>', 'api key value')
    .option('--username <username>', 'default username for dry-run links')
    .action(async (_: unknown, command: Command) => {
      const options = command.opts<LoginOptions>();
      await runLogin(options);
    });

  program
    .command('logout')
    .description('remove stored api key')
    .action(async () => {
      await runLogout();
    });

  const notes = program.command('notes').description('notes CRUD operations');

  notes
    .command('list')
    .option('--state <state>', 'active or deleted', 'active')
    .option('--endpoint <url>', 'api endpoint override')
    .option('--json', 'output machine readable json')
    .option('--no-color', 'disable ansi colors')
    .action(async (_: unknown, command: Command) => {
      const options = command.opts<NotesListOptions>();
      await runNotesList(options, command);
    });

  notes
    .command('read')
    .argument('<username>', 'username')
    .argument('<slug>', 'note slug')
    .option('--endpoint <url>', 'site url override')
    .option('--json', 'output machine readable json')
    .option('--no-color', 'disable ansi colors')
    .action(async (username: string, slug: string, options: NotesReadOptions, command: Command) => {
      await runNotesRead(username, slug, options, command);
    });

  notes
    .command('update')
    .argument('<id>', 'note id')
    .option('-p, --path <path>', 'path to markdown file')
    .option('--stdin', 'read markdown from stdin')
    .option('--title <title>', 'note title (falls back to markdown H1)')
    .option('--visibility <visibility>', 'public or private', 'public')
    .option('--expire-days <days>', 'expiration in days (max 30)', '30')
    .option('--max-bytes <bytes>', 'max accepted input bytes')
    .option('--endpoint <url>', 'api endpoint override')
    .option('--json', 'output machine readable json')
    .option('--no-color', 'disable ansi colors')
    .action(async (id: string, options: NotesUpdateOptions, command: Command) => {
      await runNotesUpdate(id, options, command);
    });

  notes
    .command('delete')
    .argument('<id>', 'note id')
    .option('--permanent', 'hard delete immediately')
    .option('--endpoint <url>', 'api endpoint override')
    .option('--json', 'output machine readable json')
    .option('--no-color', 'disable ansi colors')
    .action(async (id: string, options: NotesDeleteOptions, command: Command) => {
      await runNotesDelete(id, options, command);
    });

  const links = program.command('links').description('quick links CRUD operations');

  links
    .command('list')
    .option('--endpoint <url>', 'api endpoint override')
    .option('--json', 'output machine readable json')
    .option('--no-color', 'disable ansi colors')
    .action(async (_: unknown, command: Command) => {
      const options = command.opts<LinksListOptions>();
      await runLinksList(options, command);
    });

  links
    .command('create')
    .requiredOption('--key <key>', 'link key')
    .requiredOption('--target <url>', 'target url')
    .option('--label <label>', 'optional label')
    .option('--endpoint <url>', 'api endpoint override')
    .option('--json', 'output machine readable json')
    .option('--no-color', 'disable ansi colors')
    .action(async (_: unknown, command: Command) => {
      const options = command.opts<LinksCreateOptions>();
      await runLinksCreate(options, command);
    });

  links
    .command('update')
    .argument('<id>', 'quick link id')
    .requiredOption('--key <key>', 'link key')
    .requiredOption('--target <url>', 'target url')
    .option('--label <label>', 'optional label')
    .option('--endpoint <url>', 'api endpoint override')
    .option('--json', 'output machine readable json')
    .option('--no-color', 'disable ansi colors')
    .action(async (id: string, options: LinksUpdateOptions, command: Command) => {
      await runLinksUpdate(id, options, command);
    });

  links
    .command('delete')
    .argument('<id>', 'quick link id')
    .option('--endpoint <url>', 'api endpoint override')
    .option('--json', 'output machine readable json')
    .option('--no-color', 'disable ansi colors')
    .action(async (id: string, options: LinksDeleteOptions, command: Command) => {
      await runLinksDelete(id, options, command);
    });

  const config = program.command('config').description('manage persistent bri config');

  config
    .command('list')
    .option('--json', 'output machine readable json')
    .action(async (_: unknown, command: Command) => {
      const options = command.opts<ConfigOptions>();
      await runConfigList(options);
    });

  config
    .command('set')
    .argument('<key>', `one of: ${CONFIG_KEYS.join(', ')}`)
    .argument('<value>', 'value to save')
    .action(async (key: string, value: string) => {
      await runConfigSet(key, value);
    });

  config
    .command('unset')
    .argument('<key>', `one of: ${CONFIG_KEYS.join(', ')}`)
    .action(async (key: string) => {
      await runConfigUnset(key);
    });

  config
    .command('reset')
    .description('clear all config values')
    .action(async () => {
      await runConfigReset();
    });

  await program.parseAsync(normalizeArgv(process.argv));
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`[error] ${message}`);
  process.exit(1);
});
