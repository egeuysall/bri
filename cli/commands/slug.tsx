import { option } from 'pastel';
import zod from 'zod';
import { runSlug } from '../actions/system';
import { RunCommand } from '../core/pastel';
import { colorOption, jsonOption, updateCheckOption } from '../core/schemas';
import type { SlugOptions } from '../core/shared';

export const description = 'Generate slug from markdown without publishing';

export const options = zod.object({
  path: zod.string().optional().describe(option({ description: 'Path to markdown file', alias: 'p' })),
  stdin: zod.boolean().describe('Read markdown from stdin'),
  maxBytes: zod.string().optional().describe('Max accepted input bytes'),
  json: jsonOption,
  color: colorOption,
  updateCheck: updateCheckOption,
});

type Props = {
  options: zod.infer<typeof options>;
};

export default function Slug({ options: parsedOptions }: Props) {
  return (
    <RunCommand
      label="Generating slug"
      json={parsedOptions.json}
      updateCheck={parsedOptions.updateCheck}
      action={(command) => runSlug(parsedOptions as SlugOptions, command)}
    />
  );
}
