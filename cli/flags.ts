import { reportValue } from '@vercel/flags';
import { createClient, type FlagsClient } from '@vercel/flags-core';

export interface CliFeatureFlags {
  autoOpen: boolean;
  autoCopy: boolean;
  useColor: boolean;
  retries: number;
  timeoutMs: number;
}

const TRUE_VALUES = new Set(['1', 'true', 'yes', 'on']);
const FALSE_VALUES = new Set(['0', 'false', 'no', 'off']);

const FLAG_KEYS = {
  autoOpen: 'bri-cli-auto-open',
  autoCopy: 'bri-cli-auto-copy',
  useColor: 'bri-cli-use-color',
  retries: 'bri-cli-retries',
  timeoutMs: 'bri-cli-timeout-ms',
} as const;

function parseBoolean(raw: string | undefined): boolean | undefined {
  if (typeof raw !== 'string') {
    return undefined;
  }

  const normalized = raw.trim().toLowerCase();

  if (TRUE_VALUES.has(normalized)) {
    return true;
  }

  if (FALSE_VALUES.has(normalized)) {
    return false;
  }

  return undefined;
}

function parseInteger(raw: string | undefined): number | undefined {
  if (typeof raw !== 'string') {
    return undefined;
  }

  const value = Number.parseInt(raw, 10);
  if (!Number.isFinite(value) || value <= 0) {
    return undefined;
  }

  return value;
}

async function evaluateBooleanFlag(client: FlagsClient | null, key: string, fallback: boolean): Promise<boolean> {
  if (!client) {
    return fallback;
  }

  try {
    const result = await client.evaluate<boolean>(key, fallback, {
      app: 'bridge',
      runtime: 'bri',
      platform: process.platform,
    });

    if (typeof result.value === 'boolean') {
      return result.value;
    }
  } catch {
    // Fall through to fallback.
  }

  return fallback;
}

async function evaluateNumberFlag(client: FlagsClient | null, key: string, fallback: number): Promise<number> {
  if (!client) {
    return fallback;
  }

  try {
    const result = await client.evaluate<number>(key, fallback, {
      app: 'bridge',
      runtime: 'bri',
      platform: process.platform,
    });

    if (typeof result.value === 'number' && Number.isFinite(result.value) && result.value > 0) {
      return Math.floor(result.value);
    }
  } catch {
    // Fall through to fallback.
  }

  return fallback;
}

export async function initFlagsClient(): Promise<FlagsClient | null> {
  const sdkKey = process.env.FLAGS ?? process.env.FLAGS_SDK_KEY ?? process.env.VERCEL_FLAGS_SDK_KEY;

  if (!sdkKey) {
    return null;
  }

  try {
    const client = createClient(sdkKey, {
      stream: false,
      polling: false,
    });

    await client.initialize();
    return client;
  } catch {
    return null;
  }
}

export async function closeFlagsClient(client: FlagsClient | null): Promise<void> {
  if (!client) {
    return;
  }

  try {
    await client.shutdown();
  } catch {
    // Ignore shutdown errors.
  }
}

export async function resolveCliFlags(client: FlagsClient | null, defaults: CliFeatureFlags): Promise<CliFeatureFlags> {
  const autoOpenFallback = parseBoolean(process.env.BRI_FLAG_AUTO_OPEN ?? process.env.BRIDGE_FLAG_AUTO_OPEN) ?? defaults.autoOpen;
  const autoCopyFallback = parseBoolean(process.env.BRI_FLAG_AUTO_COPY ?? process.env.BRIDGE_FLAG_AUTO_COPY) ?? defaults.autoCopy;
  const useColorFallback = parseBoolean(process.env.BRI_FLAG_USE_COLOR ?? process.env.BRIDGE_FLAG_USE_COLOR) ?? defaults.useColor;
  const retriesFallback = parseInteger(process.env.BRI_FLAG_RETRIES ?? process.env.BRIDGE_FLAG_RETRIES) ?? defaults.retries;
  const timeoutFallback = parseInteger(process.env.BRI_FLAG_TIMEOUT_MS ?? process.env.BRIDGE_FLAG_TIMEOUT_MS) ?? defaults.timeoutMs;

  const resolved: CliFeatureFlags = {
    autoOpen: await evaluateBooleanFlag(client, FLAG_KEYS.autoOpen, autoOpenFallback),
    autoCopy: await evaluateBooleanFlag(client, FLAG_KEYS.autoCopy, autoCopyFallback),
    useColor: await evaluateBooleanFlag(client, FLAG_KEYS.useColor, useColorFallback),
    retries: await evaluateNumberFlag(client, FLAG_KEYS.retries, retriesFallback),
    timeoutMs: await evaluateNumberFlag(client, FLAG_KEYS.timeoutMs, timeoutFallback),
  };

  try {
    reportValue(FLAG_KEYS.autoOpen, resolved.autoOpen);
    reportValue(FLAG_KEYS.autoCopy, resolved.autoCopy);
    reportValue(FLAG_KEYS.useColor, resolved.useColor);
    reportValue(FLAG_KEYS.retries, resolved.retries);
    reportValue(FLAG_KEYS.timeoutMs, resolved.timeoutMs);
  } catch {
    // Best effort in local runtime.
  }

  return resolved;
}
