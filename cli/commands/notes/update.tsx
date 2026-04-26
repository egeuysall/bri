import { argument, option } from 'pastel';
import zod from 'zod';
import { runNotesUpdate } from '../../actions/resources';
import { RunCommand } from '../../core/pastel';
import { colorOption, endpointOption, jsonOption, updateCheckOption } from '../../core/schemas';
import type { NotesUpdateOptions } from '../../core/shared';

export const description = 'Update a note';

export const args = zod.tuple([zod.string().describe(argument({ name: 'id', description: 'Note ID' }))]);

export const options = zod.object({
  path: zod.string().optional().describe(option({ description: 'Path to markdown file', alias: 'p' })),
  stdin: zod.boolean().describe('Read markdown from stdin'),
  title: zod.string().optional().describe('Note title (falls back to markdown H1)'),
  visibility: zod.enum(['public', 'private']).default('public').describe('Public or private'),
  expireDays: zod.string().default('30').describe('Expiration in days (max 30)'),
  maxBytes: zod.string().optional().describe('Max accepted input bytes'),
  endpoint: endpointOption,
  json: jsonOption,
  color: colorOption,
  updateCheck: updateCheckOption,
});

type Props = { args: zod.infer<typeof args>; options: zod.infer<typeof options> };

export default function NotesUpdate({ args: parsedArgs, options: parsedOptions }: Props) {
  return (
    <RunCommand
      label="Updating note"
      json={parsedOptions.json}
      updateCheck={parsedOptions.updateCheck}
      action={(command) => runNotesUpdate(parsedArgs[0], parsedOptions as NotesUpdateOptions, command)}
    />
  );
}
