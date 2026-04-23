#!/usr/bin/env bun

import process from 'node:process';
import { Command } from 'commander';
import { runPublish } from './commands/publish';
import {
  runInvite,
  runLinksCreate,
  runLinksDelete,
  runLinksList,
  runLinksUpdate,
  runNotesDelete,
  runNotesList,
  runNotesRead,
  runNotesUpdate,
  runNotificationsDismiss,
  runNotificationsList,
  runNotificationsOpen,
} from './commands/resources';
import {
  CONFIG_KEYS,
  runConfigList,
  runConfigReset,
  runConfigSet,
  runConfigUnset,
  runDoctor,
  runLogin,
  runLogout,
  runSelfUpdate,
  runSlug,
} from './commands/system';
import {
  type ConfigOptions,
  type DoctorOptions,
  type InviteOptions,
  type LinksCreateOptions,
  type LinksDeleteOptions,
  type LinksListOptions,
  type LinksUpdateOptions,
  type LoginOptions,
  type NotesDeleteOptions,
  type NotesListOptions,
  type NotesReadOptions,
  type NotesUpdateOptions,
  type NotificationsActionOptions,
  type NotificationsListOptions,
  type PublishOptions,
  type SelfUpdateOptions,
  type SlugOptions,
  VERSION,
  createPrinter,
  maybeCheckUpdates,
  normalizeArgv,
  renderTopHelp,
} from './core/shared';

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
  program.option('--no-update-check', 'skip 24h update check');
  program.hook('preAction', async (_thisCommand, actionCommand) => {
    if (actionCommand.name() === 'self-update') {
      return;
    }

    const options = actionCommand.optsWithGlobals<{
      updateCheck?: boolean;
      color?: boolean;
      json?: boolean;
      quiet?: boolean;
    }>();
    const color = typeof options.color === 'boolean' ? options.color : process.stdout.isTTY;
    const quiet = Boolean(options.quiet) || Boolean(options.json);
    const printer = createPrinter(color, quiet);
    await maybeCheckUpdates(options.updateCheck !== false, printer);
  });

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
    .action(async (_unused: unknown, command: Command) => {
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
    .action(async (_unused: unknown, command: Command) => {
      const options = command.opts<SlugOptions>();
      await runSlug(options, command);
    });

  program
    .command('doctor')
    .description('run local runtime checks')
    .option('--endpoint <url>', 'api endpoint to probe')
    .option('--json', 'output machine readable json')
    .option('--no-color', 'disable ansi colors')
    .action(async (_unused: unknown, command: Command) => {
      const options = command.opts<DoctorOptions>();
      await runDoctor(options, command);
    });

  program
    .command('self-update')
    .description('check for and install the latest released binary')
    .option('--check-only', 'only report whether an update is available')
    .option('--yes', 'non-interactive mode for scripts')
    .option('-q, --quiet', 'reduce non-essential logs')
    .option('--install-path <path>', 'explicit installed binary path to replace')
    .option('--json', 'output machine readable json')
    .option('--no-color', 'disable ansi colors')
    .action(async (_unused: unknown, command: Command) => {
      const options = command.opts<SelfUpdateOptions>();
      await runSelfUpdate(options, command);
    });

  program
    .command('login')
    .description('store api key for authenticated CLI operations')
    .requiredOption('--api-key <key>', 'api key value')
    .option('--username <username>', 'default username for dry-run links')
    .action(async (_unused: unknown, command: Command) => {
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
    .action(async (_unused: unknown, command: Command) => {
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

  notes
    .command('invite')
    .argument('<id>', 'note id')
    .requiredOption('--username <username>', 'invitee username')
    .option('--endpoint <url>', 'api endpoint override')
    .option('--json', 'output machine readable json')
    .option('--no-color', 'disable ansi colors')
    .action(async (id: string, options: InviteOptions, command: Command) => {
      await runInvite('note', id, options, command);
    });

  const links = program.command('links').description('quick links CRUD operations');

  links
    .command('list')
    .option('--endpoint <url>', 'api endpoint override')
    .option('--json', 'output machine readable json')
    .option('--no-color', 'disable ansi colors')
    .action(async (_unused: unknown, command: Command) => {
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
    .action(async (_unused: unknown, command: Command) => {
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

  links
    .command('invite')
    .argument('<id>', 'quick link id')
    .requiredOption('--username <username>', 'invitee username')
    .option('--endpoint <url>', 'api endpoint override')
    .option('--json', 'output machine readable json')
    .option('--no-color', 'disable ansi colors')
    .action(async (id: string, options: InviteOptions, command: Command) => {
      await runInvite('link', id, options, command);
    });

  const notifications = program.command('notifications').description('notifications inbox');

  notifications
    .command('list')
    .option('--endpoint <url>', 'api endpoint override')
    .option('--json', 'output machine readable json')
    .option('--no-color', 'disable ansi colors')
    .action(async (_unused: unknown, command: Command) => {
      const options = command.opts<NotificationsListOptions>();
      await runNotificationsList(options, command);
    });

  notifications
    .command('open')
    .argument('<id>', 'notification id')
    .option('--endpoint <url>', 'api endpoint override')
    .option('--json', 'output machine readable json')
    .option('--no-color', 'disable ansi colors')
    .action(async (id: string, options: NotificationsActionOptions, command: Command) => {
      await runNotificationsOpen(id, options, command);
    });

  notifications
    .command('dismiss')
    .argument('<id>', 'notification id')
    .option('--endpoint <url>', 'api endpoint override')
    .option('--json', 'output machine readable json')
    .option('--no-color', 'disable ansi colors')
    .action(async (id: string, options: NotificationsActionOptions, command: Command) => {
      await runNotificationsDismiss(id, options, command);
    });

  const config = program.command('config').description('manage persistent bri config');

  config
    .command('list')
    .option('--json', 'output machine readable json')
    .action(async (_unused: unknown, command: Command) => {
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
