import { option } from 'pastel';
import zod from 'zod';
import { runPublish } from '../actions/publish';
import { RunCommand } from '../core/pastel';
import { colorOption, jsonOption, quietOption, updateCheckOption } from '../core/schemas';
import type { PublishOptions } from '../core/shared';

export const description = 'Publish markdown to bri';
export const isDefault = true;

export const options = zod.object({
  path: zod.string().optional().describe(option({ description: 'Path to markdown file', alias: 'p' })),
  stdin: zod.boolean().describe('Read markdown from stdin'),
  title: zod.string().optional().describe('Note title (falls back to markdown H1)'),
  visibility: zod.enum(['public', 'private']).default('public').describe('Public or private'),
  expireDays: zod.string().default('30').describe('Expiration in days (max 30)'),
  apiKey: zod.string().optional().describe('API key override'),
  endpoint: zod.string().optional().describe('API endpoint override'),
  siteUrl: zod.string().optional().describe('Site URL for final links'),
  timeout: zod.string().optional().describe('Request timeout in milliseconds'),
  maxBytes: zod.string().optional().describe('Max accepted input bytes'),
  retries: zod.string().optional().describe('Retry count for 5xx/network errors'),
  dryRun: zod.boolean().describe('Validate input and print resolved slug/url only'),
  json: jsonOption,
  quiet: quietOption,
  copy: zod.boolean().default(true).describe('Skip clipboard copy'),
  open: zod.boolean().default(true).describe('Skip browser open'),
  color: colorOption,
  updateCheck: updateCheckOption,
});

type Props = {
  options: zod.infer<typeof options>;
};

export default function Publish({ options: parsedOptions }: Props) {
  return (
    <RunCommand
      label="Publishing"
      quiet={parsedOptions.quiet}
      json={parsedOptions.json}
      updateCheck={parsedOptions.updateCheck}
      action={(command) => runPublish(parsedOptions as PublishOptions, command)}
    />
  );
}
