import { argument } from 'pastel';
import zod from 'zod';
import { runLinksDelete } from '../../actions/resources';
import { RunCommand } from '../../core/pastel';
import { endpointOption, jsonColorOptions } from '../../core/schemas';
import type { LinksDeleteOptions } from '../../core/shared';

export const description = 'Delete quick link';

export const args = zod.tuple([zod.string().describe(argument({ name: 'id', description: 'Quick link ID' }))]);

export const options = zod.object({
  endpoint: endpointOption,
  ...jsonColorOptions,
});

type Props = { args: zod.infer<typeof args>; options: zod.infer<typeof options> };

export default function LinksDelete({ args: parsedArgs, options: parsedOptions }: Props) {
  return (
    <RunCommand
      label="Deleting link"
      json={parsedOptions.json}
      updateCheck={parsedOptions.updateCheck}
      action={(command) => runLinksDelete(parsedArgs[0], parsedOptions as LinksDeleteOptions, command)}
    />
  );
}
