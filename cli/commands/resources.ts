import { Command } from 'commander';
import { loadConfig } from '../config';
import { fetchWithApiKey } from '../core/http';
import {
  DEFAULT_API_ENDPOINT,
  DEFAULT_MAX_BYTES,
  DEFAULT_SITE_URL,
  type InviteOptions,
  type LinksCreateOptions,
  type LinksDeleteOptions,
  type LinksListOptions,
  type LinksUpdateOptions,
  type NotesDeleteOptions,
  type NotesListOptions,
  type NotesReadOptions,
  type NotesUpdateOptions,
  type NotificationsActionOptions,
  type NotificationsListOptions,
  createPrinter,
  getStringSetting,
  openInBrowser,
  optionProvidedByCli,
  parseOptionalPositiveInt,
  parsePositiveInt,
  parseTitleFromMarkdown,
  parseVisibility,
  readMarkdownFile,
  readMarkdownStdin,
  validateUrl,
} from '../core/shared';

export async function runNotesList(options: NotesListOptions, command: Command): Promise<void> {
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

export async function runNotesRead(
  username: string,
  slug: string,
  options: NotesReadOptions,
  command: Command
): Promise<void> {
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

export async function runNotesUpdate(id: string, options: NotesUpdateOptions, command: Command): Promise<void> {
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
  const parsedDays = parseOptionalPositiveInt(options.expireDays);
  const expiresInDays = parsedDays ? Math.min(30, parsedDays) : 30;

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

export async function runNotesDelete(id: string, options: NotesDeleteOptions, command: Command): Promise<void> {
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

export async function runLinksList(options: LinksListOptions, command: Command): Promise<void> {
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

export async function runLinksCreate(options: LinksCreateOptions, command: Command): Promise<void> {
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

export async function runLinksUpdate(id: string, options: LinksUpdateOptions, command: Command): Promise<void> {
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

export async function runLinksDelete(id: string, options: LinksDeleteOptions, command: Command): Promise<void> {
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

  const data = await fetchWithApiKey({ endpoint, apiKey, method: 'DELETE' });

  if (options.json) {
    console.log(JSON.stringify({ data }, null, 2));
    return;
  }

  console.log('deleted');
}

export async function runInvite(
  kind: 'note' | 'link',
  id: string,
  options: InviteOptions,
  command: Command
): Promise<void> {
  const config = await loadConfig();
  const apiKey = (config.apiKey || process.env.BRI_API_KEY || '').trim();
  if (!apiKey) throw new Error('missing api key. run `bri login --api-key <key>`');

  const inviteeUsername = options.username?.trim().toLowerCase() || '';
  if (!inviteeUsername) throw new Error('missing invitee username');

  const endpointRaw = getStringSetting(
    command,
    'endpoint',
    options.endpoint,
    process.env.BRI_ENDPOINT,
    config.endpoint,
    DEFAULT_API_ENDPOINT
  );
  const baseEndpoint = validateUrl(endpointRaw, 'endpoint');
  const endpoint = new URL('/api/invitations', baseEndpoint);

  const data = await fetchWithApiKey({
    endpoint,
    apiKey,
    method: 'POST',
    body: {
      kind,
      id,
      inviteeUsername,
    },
  });

  if (options.json) {
    console.log(JSON.stringify({ data }, null, 2));
    return;
  }
  console.log(`invited @${inviteeUsername}`);
}

export async function runNotificationsList(
  options: NotificationsListOptions,
  command: Command
): Promise<void> {
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
  const endpoint = new URL('/api/notifications', baseEndpoint);

  const data = (await fetchWithApiKey({ endpoint, apiKey })) as {
    username?: string | null;
    items?: Array<{
      id?: string;
      kind?: string;
      message?: string;
      createdAt?: number;
      noteId?: string | null;
      linkId?: string | null;
    }>;
  };

  if (options.json) {
    console.log(JSON.stringify({ data }, null, 2));
    return;
  }

  const rows = Array.isArray(data?.items) ? data.items : [];
  if (rows.length === 0) {
    console.log('no notifications');
    return;
  }

  for (const row of rows) {
    const id = typeof row.id === 'string' ? row.id : '';
    const kind = typeof row.kind === 'string' ? row.kind : 'notice';
    const message = typeof row.message === 'string' ? row.message : '';
    const createdAt =
      typeof row.createdAt === 'number' ? new Date(row.createdAt).toISOString() : 'unknown';
    console.log(`${id}  [${kind}]  ${message}  ${createdAt}`);
  }
}

export async function runNotificationsOpen(
  notificationId: string,
  options: NotificationsActionOptions,
  command: Command
): Promise<void> {
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
  const siteUrlRaw = process.env.BRI_SITE_URL ?? config.siteUrl ?? DEFAULT_SITE_URL;
  const siteUrl = validateUrl(siteUrlRaw, 'site-url');
  const endpoint = new URL('/api/notifications', baseEndpoint);

  const data = (await fetchWithApiKey({
    endpoint,
    apiKey,
    method: 'PATCH',
    body: {
      action: 'open',
      notificationId,
    },
  })) as { href?: string | null };

  const href = typeof data?.href === 'string' ? data.href : null;

  if (options.json) {
    console.log(JSON.stringify({ data }, null, 2));
    return;
  }

  if (!href) {
    console.log('notification target unavailable');
    return;
  }

  const targetUrl = new URL(href, siteUrl).toString();
  console.log(targetUrl);
  void openInBrowser(targetUrl);
}

export async function runNotificationsDismiss(
  notificationId: string,
  options: NotificationsActionOptions,
  command: Command
): Promise<void> {
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
  const endpoint = new URL('/api/notifications', baseEndpoint);

  const data = await fetchWithApiKey({
    endpoint,
    apiKey,
    method: 'PATCH',
    body: {
      action: 'dismiss',
      notificationId,
    },
  });

  if (options.json) {
    console.log(JSON.stringify({ data }, null, 2));
    return;
  }

  console.log('dismissed');
}
