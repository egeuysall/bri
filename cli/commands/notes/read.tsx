import { argument } from 'pastel';
import zod from 'zod';
import { runNotesRead } from '../../actions/resources';
import { RunCommand } from '../../core/pastel';
import { endpointOption, jsonColorOptions } from '../../core/schemas';
import type { NotesReadOptions } from '../../core/shared';

export const description = 'Read note content';

export const args = zod.tuple([
  zod.string().describe(argument({ name: 'username', description: 'Username' })),
  zod.string().describe(argument({ name: 'slug', description: 'Note slug' })),
]);

export const options = zod.object({
  endpoint: endpointOption.describe('Site URL override'),
  ...jsonColorOptions,
});

type Props = { args: zod.infer<typeof args>; options: zod.infer<typeof options> };

export default function NotesRead({ args: parsedArgs, options: parsedOptions }: Props) {
  return (
    <RunCommand
      label="Reading note"
      json={parsedOptions.json}
      updateCheck={parsedOptions.updateCheck}
      action={(command) => runNotesRead(parsedArgs[0], parsedArgs[1], parsedOptions as NotesReadOptions, command)}
    />
  );
}
