import { promises as fs } from 'node:fs';
import os from 'node:os';
import path from 'node:path';

interface UpdateState {
  lastCheckedAt?: string;
  lastSeenVersion?: string;
}

interface RemoteVersionInfo {
  version: string;
  releaseUrl?: string;
}

const UPDATE_INTERVAL_MS = 24 * 60 * 60 * 1000;
const CACHE_DIR = path.join(os.homedir(), '.cache', 'bri');
const STATE_PATH = path.join(CACHE_DIR, 'update-state.json');
const LEGACY_STATE_PATH = path.join(os.homedir(), '.cache', 'bri', 'update-state.json');

function parseSemver(input: string): [number, number, number] {
  const match = input.trim().match(/^(\d+)\.(\d+)\.(\d+)/);
  if (!match) {
    return [0, 0, 0];
  }

  const major = match[1] ?? '0';
  const minor = match[2] ?? '0';
  const patch = match[3] ?? '0';

  return [Number.parseInt(major, 10), Number.parseInt(minor, 10), Number.parseInt(patch, 10)];
}

function isNewerVersion(remote: string, current: string): boolean {
  const [ra, rb, rc] = parseSemver(remote);
  const [ca, cb, cc] = parseSemver(current);

  if (ra !== ca) return ra > ca;
  if (rb !== cb) return rb > cb;
  return rc > cc;
}

async function loadState(): Promise<UpdateState> {
  try {
    const raw = await fs.readFile(STATE_PATH, 'utf8');
    const parsed = JSON.parse(raw) as UpdateState;
    if (!parsed || typeof parsed !== 'object') {
      return {};
    }
    return parsed;
  } catch {
    try {
      const raw = await fs.readFile(LEGACY_STATE_PATH, 'utf8');
      const parsed = JSON.parse(raw) as UpdateState;
      if (!parsed || typeof parsed !== 'object') {
        return {};
      }
      return parsed;
    } catch {
      return {};
    }
  }
}

async function saveState(state: UpdateState): Promise<void> {
  await fs.mkdir(CACHE_DIR, { recursive: true });
  await fs.writeFile(STATE_PATH, `${JSON.stringify(state, null, 2)}\n`, 'utf8');
}

async function fetchRemoteVersion(
  sourceUrl: string,
  timeoutMs: number
): Promise<RemoteVersionInfo | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(sourceUrl, {
      method: 'GET',
      headers: {
        Accept: 'application/json',
      },
      signal: controller.signal,
    });

    if (!response.ok) {
      return null;
    }

    const raw = await response.text();
    const parsed = JSON.parse(raw) as RemoteVersionInfo;

    if (!parsed || typeof parsed.version !== 'string') {
      return null;
    }

    return parsed;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

export interface UpdateCheckResult {
  hasUpdate: boolean;
  latestVersion?: string;
  releaseUrl?: string;
}

export async function checkForUpdates(options: {
  currentVersion: string;
  sourceUrl: string;
  timeoutMs?: number;
}): Promise<UpdateCheckResult> {
  const timeoutMs = options.timeoutMs ?? 2500;
  const state = await loadState();
  const now = Date.now();

  if (state.lastCheckedAt) {
    const previous = new Date(state.lastCheckedAt).getTime();
    if (Number.isFinite(previous) && now - previous < UPDATE_INTERVAL_MS) {
      if (state.lastSeenVersion && isNewerVersion(state.lastSeenVersion, options.currentVersion)) {
        return {
          hasUpdate: true,
          latestVersion: state.lastSeenVersion,
        };
      }

      return { hasUpdate: false };
    }
  }

  const remote = await fetchRemoteVersion(options.sourceUrl, timeoutMs);

  const nextState: UpdateState = {
    ...state,
    lastCheckedAt: new Date(now).toISOString(),
  };

  if (remote?.version) {
    nextState.lastSeenVersion = remote.version;
  }

  await saveState(nextState);

  if (!remote?.version) {
    return { hasUpdate: false };
  }

  return {
    hasUpdate: isNewerVersion(remote.version, options.currentVersion),
    latestVersion: remote.version,
    releaseUrl: remote.releaseUrl,
  };
}
