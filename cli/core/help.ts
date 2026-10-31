export type CommandRow = {
  command: string;
  description: string;
  group: 'publish' | 'library' | 'account' | 'system';
};

export const cliHelpRows: CommandRow[] = [
  { command: 'bri publish --path <file>', description: 'Publish markdown note', group: 'publish' },
  { command: 'bri publish --stdin', description: 'Publish piped markdown', group: 'publish' },
  { command: 'bri slug --path <file>', description: 'Preview generated slug', group: 'publish' },
  { command: 'bri notes list', description: 'List your notes', group: 'library' },
  { command: 'bri notes read <user> <slug>', description: 'Read note content', group: 'library' },
  { command: 'bri notes update <id>', description: 'Update a note', group: 'library' },
  { command: 'bri notes delete <id>', description: 'Move a note to recently deleted', group: 'library' },
  { command: 'bri notes invite <id>', description: 'Invite a user to a private note', group: 'library' },
  { command: 'bri notes history <id>', description: 'List note versions', group: 'library' },
  { command: 'bri notes version <id> <version>', description: 'Read a note version', group: 'library' },
  { command: 'bri notes restore-version <id> <version>', description: 'Restore a note version', group: 'library' },
  { command: 'bri notes ask <user> <slug> --question <q>', description: 'Ask AI about a note', group: 'library' },
  { command: 'bri links list', description: 'List quick links', group: 'library' },
  { command: 'bri links create --key <key>', description: 'Create quick link', group: 'library' },
  { command: 'bri links update <id>', description: 'Update a quick link', group: 'library' },
  { command: 'bri links delete <id>', description: 'Delete a quick link', group: 'library' },
  { command: 'bri links invite <id>', description: 'Invite a user to a private link', group: 'library' },
  { command: 'bri notifications list', description: 'Show invites and alerts', group: 'account' },
  { command: 'bri notifications open <id>', description: 'Open a notification', group: 'account' },
  { command: 'bri notifications dismiss <id>', description: 'Dismiss a notification', group: 'account' },
  { command: 'bri login --api-key <key>', description: 'Save API key locally', group: 'account' },
  { command: 'bri logout', description: 'Remove local credentials', group: 'account' },
  { command: 'bri config list', description: 'Show local defaults', group: 'account' },
  { command: 'bri config set <key> <value>', description: 'Set a local default', group: 'account' },
  { command: 'bri config unset <key>', description: 'Remove a local default', group: 'account' },
  { command: 'bri config reset', description: 'Reset local defaults', group: 'account' },
  { command: 'bri doctor', description: 'Check runtime and endpoint', group: 'system' },
  { command: 'bri mcp', description: 'Start stdio MCP server', group: 'system' },
  { command: 'bri self-update --check-only', description: 'Check CLI release', group: 'system' },
];
