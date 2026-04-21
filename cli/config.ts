import { promises as fs } from 'node:fs';
import os from 'node:os';
import path from 'node:path';

export interface BriConfig {
  endpoint?: string;
  siteUrl?: string;
  apiKey?: string;
  username?: string;
  timeoutMs?: number;
  maxBytes?: number;
  retries?: number;
  copy?: boolean;
  open?: boolean;
  color?: boolean;
}

const CONFIG_DIR = path.join(os.homedir(), '.config', 'bri');
const CONFIG_PATH = path.join(CONFIG_DIR, 'config.json');
const LEGACY_CONFIG_PATH = path.join(os.homedir(), '.config', 'bri', 'config.json');

export function getConfigPath(): string {
  return CONFIG_PATH;
}

export async function loadConfig(): Promise<BriConfig> {
  try {
    const raw = await fs.readFile(CONFIG_PATH, 'utf8');
    const parsed = JSON.parse(raw) as BriConfig;

    if (!parsed || typeof parsed !== 'object') {
      return {};
    }

    return parsed;
  } catch {
    try {
      const raw = await fs.readFile(LEGACY_CONFIG_PATH, 'utf8');
      const parsed = JSON.parse(raw) as BriConfig;
      if (!parsed || typeof parsed !== 'object') {
        return {};
      }
      return parsed;
    } catch {
      return {};
    }
  }
}

export async function saveConfig(config: BriConfig): Promise<void> {
  await fs.mkdir(CONFIG_DIR, { recursive: true });
  const normalized = JSON.stringify(config, null, 2);
  await fs.writeFile(CONFIG_PATH, `${normalized}\n`, 'utf8');
}

export async function updateConfig(patch: Partial<BriConfig>): Promise<BriConfig> {
  const current = await loadConfig();
  const next = {
    ...current,
    ...patch,
  };

  await saveConfig(next);
  return next;
}

export async function unsetConfigKey(key: keyof BriConfig): Promise<BriConfig> {
  const current = await loadConfig();
  if (key in current) {
    delete current[key];
  }
  await saveConfig(current);
  return current;
}
