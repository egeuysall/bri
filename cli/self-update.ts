import { createHash } from 'node:crypto';
import { promises as fs } from 'node:fs';
import path from 'node:path';

interface GitHubReleaseAsset {
  name: string;
  browser_download_url: string;
}

interface GitHubRelease {
  tag_name?: string;
  html_url?: string;
  assets?: GitHubReleaseAsset[];
}

export interface SelfUpdateResult {
  status: 'up-to-date' | 'update-available' | 'updated' | 'not-installed';
  currentVersion: string;
  latestVersion: string;
  releaseUrl?: string;
  binaryPath?: string;
}

function normalizeVersion(raw: string): string {
  return raw.trim().replace(/^v/i, '');
}

function parseSemver(input: string): [number, number, number] {
  const match = normalizeVersion(input).match(/^(\d+)\.(\d+)\.(\d+)/);
  if (!match) return [0, 0, 0];
  return [
    Number.parseInt(match[1] ?? '0', 10),
    Number.parseInt(match[2] ?? '0', 10),
    Number.parseInt(match[3] ?? '0', 10),
  ];
}

function isNewerVersion(remote: string, current: string): boolean {
  const [ra, rb, rc] = parseSemver(remote);
  const [ca, cb, cc] = parseSemver(current);

  if (ra !== ca) return ra > ca;
  if (rb !== cb) return rb > cb;
  return rc > cc;
}

function detectAssetName(): string {
  const platform = process.platform;
  const arch = process.arch;

  let osLabel: string;
  let archLabel: string;

  if (platform === 'darwin') {
    osLabel = 'darwin';
  } else if (platform === 'linux') {
    osLabel = 'linux';
  } else if (platform === 'win32') {
    osLabel = 'windows';
  } else {
    throw new Error(`unsupported operating system: ${platform}`);
  }

  if (arch === 'x64') {
    archLabel = 'x64';
  } else if (arch === 'arm64') {
    archLabel = 'arm64';
  } else {
    throw new Error(`unsupported architecture: ${arch}`);
  }

  const ext = platform === 'win32' ? '.exe' : '';
  return `bri-${osLabel}-${archLabel}${ext}`;
}

function resolveBinaryPath(installPath?: string): string | null {
  if (installPath && installPath.trim()) {
    return path.resolve(installPath);
  }

  const envInstallPath = process.env.BRI_INSTALL_PATH;
  if (envInstallPath && envInstallPath.trim()) {
    return path.resolve(envInstallPath);
  }

  const execPath = process.execPath;
  const execBase = path.basename(execPath).toLowerCase();

  if (execBase === 'bun' || execBase === 'bunx' || execBase === 'node' || execBase === 'nodejs') {
    return null;
  }

  return execPath;
}

async function fetchJson<T>(url: string): Promise<T> {
  const response = await fetch(url, {
    method: 'GET',
    headers: {
      Accept: 'application/vnd.github+json',
      'User-Agent': 'bri-cli',
    },
  });

  if (!response.ok) {
    throw new Error(`request failed (${response.status}) for ${url}`);
  }

  return (await response.json()) as T;
}

async function fetchBinary(url: string): Promise<Uint8Array> {
  const response = await fetch(url, {
    method: 'GET',
    headers: {
      Accept: 'application/octet-stream',
      'User-Agent': 'bri-cli',
    },
  });

  if (!response.ok) {
    throw new Error(`download failed (${response.status}) for ${url}`);
  }

  const buffer = await response.arrayBuffer();
  return new Uint8Array(buffer);
}

function parseChecksumTable(content: string): Map<string, string> {
  const checksums = new Map<string, string>();

  for (const line of content.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    const match = trimmed.match(/^([a-fA-F0-9]{64})\s+\*?(.+)$/);
    if (!match) continue;
    const hash = (match[1] ?? '').toLowerCase();
    const name = (match[2] ?? '').trim();
    if (!name) continue;
    checksums.set(name, hash);
  }

  return checksums;
}

function sha256Hex(input: Uint8Array): string {
  return createHash('sha256').update(input).digest('hex').toLowerCase();
}

async function replaceBinary(targetPath: string, payload: Uint8Array): Promise<void> {
  const targetDir = path.dirname(targetPath);
  const tempPath = path.join(
    targetDir,
    `.bri-update-${Date.now()}-${Math.random().toString(16).slice(2)}`
  );

  await fs.mkdir(targetDir, { recursive: true });
  await fs.writeFile(tempPath, payload, { mode: 0o755 });
  await fs.chmod(tempPath, 0o755);

  try {
    await fs.rename(tempPath, targetPath);
  } catch (error) {
    await fs.rm(tempPath, { force: true });
    throw error;
  }
}

export async function performSelfUpdate(options: {
  currentVersion: string;
  repo: string;
  checkOnly?: boolean;
  installPath?: string;
}): Promise<SelfUpdateResult> {
  const currentVersion = normalizeVersion(options.currentVersion);
  const release = await fetchJson<GitHubRelease>(
    `https://api.github.com/repos/${options.repo}/releases/latest`
  );

  const latestVersion = normalizeVersion(release.tag_name ?? '');
  if (!latestVersion) {
    throw new Error('latest release is missing tag_name');
  }

  if (!isNewerVersion(latestVersion, currentVersion)) {
    return {
      status: 'up-to-date',
      currentVersion,
      latestVersion,
      releaseUrl: release.html_url,
    };
  }

  const binaryPath = resolveBinaryPath(options.installPath);
  if (!binaryPath) {
    return {
      status: 'not-installed',
      currentVersion,
      latestVersion,
      releaseUrl: release.html_url,
    };
  }

  if (options.checkOnly) {
    return {
      status: 'update-available',
      currentVersion,
      latestVersion,
      releaseUrl: release.html_url,
      binaryPath,
    };
  }

  const assets = release.assets ?? [];
  const assetName = detectAssetName();
  const binaryAsset = assets.find((item) => item.name === assetName);
  const checksumAsset = assets.find((item) => item.name === 'SHA256SUMS');

  if (!binaryAsset) {
    throw new Error(`release asset not found: ${assetName}`);
  }
  if (!checksumAsset) {
    throw new Error('release asset not found: SHA256SUMS');
  }

  const [binaryBytes, checksumBytes] = await Promise.all([
    fetchBinary(binaryAsset.browser_download_url),
    fetchBinary(checksumAsset.browser_download_url),
  ]);

  const checksumMap = parseChecksumTable(new TextDecoder().decode(checksumBytes));
  const expectedHash = checksumMap.get(assetName);

  if (!expectedHash) {
    throw new Error(`SHA256SUMS missing entry for ${assetName}`);
  }

  const actualHash = sha256Hex(binaryBytes);
  if (actualHash !== expectedHash) {
    throw new Error(`checksum mismatch for ${assetName}`);
  }

  await replaceBinary(binaryPath, binaryBytes);

  return {
    status: 'updated',
    currentVersion,
    latestVersion,
    releaseUrl: release.html_url,
    binaryPath,
  };
}
