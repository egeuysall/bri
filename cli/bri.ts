#!/usr/bin/env bun

import process from 'node:process';
import Pastel from 'pastel';
import { renderTopHelp, VERSION, normalizeArgv } from './core/shared';

async function main(): Promise<void> {
  const argv = process.argv.slice(2);
  const wantsTopHelp = argv.some((arg) => arg === '-h' || arg === '--help' || arg === 'help');
  const topLevelOnlyFlags = argv.every((arg) =>
    ['--no-color', '--no-update-check', '-h', '--help', 'help'].includes(arg)
  );
  const hasCommand = argv.some((arg) =>
    [
      'publish',
      'slug',
      'doctor',
      'self-update',
      'login',
      'logout',
      'notes',
      'links',
      'notifications',
      'config',
    ].includes(arg)
  );

  if (argv.length === 0 || ((wantsTopHelp || topLevelOnlyFlags) && !hasCommand)) {
    renderTopHelp(process.stdout.isTTY && !argv.includes('--no-color'));
    return;
  }

  const app = new Pastel({
    importMeta: import.meta,
    name: 'bri',
    version: VERSION,
    description: 'bri CLI: publish markdown to bri',
  });

  await app.run(normalizeArgv(process.argv));
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(message);
  process.exit(1);
});
