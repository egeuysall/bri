import { argument } from 'pastel';
import zod from 'zod';
import { runNotesDelete } from '../../actions/resources';
import { RunCommand } from '../../core/pastel';
import { endpointOption, jsonColorOptions } from '../../core/schemas';
import type { NotesDeleteOptions } from '../../core/shared';

export const description = 'Delete a note';

export const args = zod.tuple([zod.string().describe(argument({ name: 'id', description: 'Note ID' }))]);

export const options = zod.object({
  permanent: zod.boolean().describe('Hard delete immediately'),
  endpoint: endpointOption,
  ...jsonColorOptions,
});

type Props = { args: zod.infer<typeof args>; options: zod.infer<typeof options> };

export default function NotesDelete({ args: parsedArgs, options: parsedOptions }: Props) {
  return (
    <RunCommand
      label="Deleting note"
      json={parsedOptions.json}
      updateCheck={parsedOptions.updateCheck}
      action={(command) => runNotesDelete(parsedArgs[0], parsedOptions as NotesDeleteOptions, command)}
    />
  );
}
