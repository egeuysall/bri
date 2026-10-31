import { mkdir, readdir, rm, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';

const root = process.cwd();
const cliRoot = resolve(root, 'cli');
const outputDir = resolve(cliRoot, '.demo-runtime');

async function sourceFiles(directory: string): Promise<string[]> {
  const entries = await readdir(directory, { withFileTypes: true });
  const nested = await Promise.all(entries.map(async (entry) => {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) return sourceFiles(path);
    if (!/\.tsx?$/.test(entry.name) || entry.name.endsWith('.d.ts')) return [];
    return [path];
  }));
  return nested.flat();
}

await rm(outputDir, { recursive: true, force: true });
await mkdir(outputDir, { recursive: true });

const commandEntries = await sourceFiles(join(cliRoot, 'commands'));
const entrypoints = [join(cliRoot, 'demo-entry.ts'), ...commandEntries];
const result = await Bun.build({
  entrypoints,
  outdir: outputDir,
  root: cliRoot,
  target: 'node',
  packages: 'bundle',
  splitting: true,
  naming: { entry: '[dir]/[name].js' },
});

if (!result.success) {
  for (const log of result.logs) console.error(log);
  process.exitCode = 1;
} else {
  await writeFile(join(outputDir, 'package.json'), '{"type":"module"}\n');
  console.log(`built ${commandEntries.length} bri commands for the public cli demo`);
}
