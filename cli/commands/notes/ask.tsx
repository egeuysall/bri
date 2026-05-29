import { argument } from 'pastel';
import zod from 'zod';
import { runNotesAsk } from '../../actions/resources';
import { RunCommand } from '../../core/pastel';
import { endpointOption, jsonColorOptions } from '../../core/schemas';
import type { NotesAskOptions } from '../../core/shared';

export const description = 'Ask AI about a note';

export const args = zod.tuple([
  zod.string().describe(argument({ name: 'username', description: 'Username' })),
  zod.string().describe(argument({ name: 'slug', description: 'Note slug' })),
]);

export const options = zod.object({
  endpoint: endpointOption.describe('Site URL override'),
  question: zod.string().optional().describe('Question to ask'),
  stdin: zod.boolean().describe('Read question from stdin'),
  ...jsonColorOptions,
});

type Props = { args: zod.infer<typeof args>; options: zod.infer<typeof options> };

export default function NotesAsk({ args: parsedArgs, options: parsedOptions }: Props) {
  return (
    <RunCommand
      label="Asking AI"
      json={parsedOptions.json}
      updateCheck={parsedOptions.updateCheck}
      action={(command) => runNotesAsk(parsedArgs[0], parsedArgs[1], parsedOptions as NotesAskOptions, command)}
    />
  );
}
