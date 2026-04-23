import { Command } from 'commander';
import {
  type BriConfig,
  getConfigPath,
  loadConfig,
  saveConfig,
  unsetConfigKey,
  updateConfig,
} from '../config';
import { generateSlug } from '../slug';
import {
  DEFAULT_API_ENDPOINT,
  DEFAULT_MAX_BYTES,
  type ConfigOptions,
  type DoctorOptions,
  type LoginOptions,
  RELEASE_REPO,
  type SelfUpdateOptions,
  type SlugOptions,
  VERSION,
  ansi,
  colorize,
  createPrinter,
  hasBinary,
  optionProvidedByCli,
  parseOptionalBoolean,
  parseOptionalPositiveInt,
  parsePositiveInt,
  readMarkdownFile,
  readMarkdownStdin,
  validateUrl,
} from '../core/shared';
import { performSelfUpdate } from '../self-update';

export type ConfigKey = keyof BriConfig;

export const CONFIG_KEYS: ConfigKey[] = [
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

function statusFromErrorMessage(message: string): number {
  if (
    message.includes('No auth provider found') ||
    message.includes('Invalid token') ||
    message.includes('Not authenticated')
  ) {
    return 401;
  }
  return 500;
}

export async function runLogin(options: LoginOptions): Promise<void> {
  const apiKey = options.apiKey?.trim();
  if (!apiKey) throw new Error('missing api key');

  const username = options.username?.trim().toLowerCase();
  await updateConfig({
    apiKey,
    ...(username ? { username } : {}),
  });
  console.log('login saved');
}

export async function runLogout(): Promise<void> {
  await unsetConfigKey('apiKey');
  console.log('logged out');
}

export async function runSlug(options: SlugOptions, command: Command): Promise<void> {
  const maxBytes = optionProvidedByCli(command, 'maxBytes')
    ? parsePositiveInt(options.maxBytes, 'max-bytes')
    : (parseOptionalPositiveInt(process.env.BRI_MAX_BYTES) ?? DEFAULT_MAX_BYTES);

  const color = optionProvidedByCli(command, 'color') ? options.color : process.stdout.isTTY;
  const printer = createPrinter(color, Boolean(options.json));

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

export async function runDoctor(options: DoctorOptions, command: Command): Promise<void> {
  const color = optionProvidedByCli(command, 'color') ? options.color : process.stdout.isTTY;
  const printer = createPrinter(color, Boolean(options.json));

  const endpointRaw =
    (optionProvidedByCli(command, 'endpoint') ? options.endpoint : undefined) ??
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
      const message = error instanceof Error ? error.message : String(error);
      checks.push({
        name: 'endpoint-reachable',
        ok: false,
        detail: `${message} (status hint ${statusFromErrorMessage(message)})`,
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

export async function runSelfUpdate(options: SelfUpdateOptions, command: Command): Promise<void> {
  const color = optionProvidedByCli(command, 'color') ? options.color : process.stdout.isTTY;
  const printer = createPrinter(color, Boolean(options.quiet) || Boolean(options.json));

  const result = await performSelfUpdate({
    currentVersion: VERSION,
    repo: RELEASE_REPO,
    checkOnly: options.checkOnly,
    installPath: options.installPath,
  });

  if (options.json) {
    console.log(JSON.stringify(result, null, 2));
    return;
  }

  if (result.status === 'up-to-date') {
    printer.ok(`already up to date (${result.currentVersion})`);
    return;
  }

  if (result.status === 'not-installed') {
    printer.warn(`update available: ${result.latestVersion} (current ${result.currentVersion})`);
    printer.info('standalone install path not detected; rerun with --install-path <path>');
    return;
  }

  if (result.status === 'update-available' || options.checkOnly) {
    printer.warn(`update available: ${result.latestVersion} (current ${result.currentVersion})`);
    if (result.releaseUrl) {
      printer.info(`release: ${result.releaseUrl}`);
    }
    return;
  }

  printer.ok(`updated to ${result.latestVersion}`);
  if (result.binaryPath) {
    printer.info(`installed: ${result.binaryPath}`);
  }
}

export async function runConfigList(options: ConfigOptions): Promise<void> {
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

export async function runConfigSet(key: string, value: string): Promise<void> {
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

export async function runConfigUnset(key: string): Promise<void> {
  if (!CONFIG_KEYS.includes(key as ConfigKey)) {
    throw new Error(`unknown key: ${key}`);
  }

  await unsetConfigKey(key as ConfigKey);
  console.log(`removed ${key}`);
}

export async function runConfigReset(): Promise<void> {
  await saveConfig({});
  console.log('config reset');
}
