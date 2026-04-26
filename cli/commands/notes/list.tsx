import zod from 'zod';
import { runNotesList } from '../../actions/resources';
import { RunCommand } from '../../core/pastel';
import { endpointOption, jsonColorOptions } from '../../core/schemas';
import type { NotesListOptions } from '../../core/shared';

export const description = 'List notes';

export const options = zod.object({
  state: zod.enum(['active', 'deleted']).default('active').describe('Active or deleted'),
  endpoint: endpointOption,
  ...jsonColorOptions,
});

type Props = { options: zod.infer<typeof options> };

export default function NotesList({ options: parsedOptions }: Props) {
  return (
    <RunCommand
      label="Loading notes"
      json={parsedOptions.json}
      updateCheck={parsedOptions.updateCheck}
      action={(command) => runNotesList(parsedOptions as NotesListOptions, command)}
    />
  );
}
