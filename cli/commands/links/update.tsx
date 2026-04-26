import { argument } from 'pastel';
import zod from 'zod';
import { runLinksUpdate } from '../../actions/resources';
import { RunCommand } from '../../core/pastel';
import { endpointOption, jsonColorOptions } from '../../core/schemas';
import type { LinksUpdateOptions } from '../../core/shared';

export const description = 'Update quick link';

export const args = zod.tuple([zod.string().describe(argument({ name: 'id', description: 'Quick link ID' }))]);

export const options = zod.object({
  key: zod.string().describe('Link key'),
  target: zod.string().describe('Target URL'),
  label: zod.string().optional().describe('Optional label'),
  endpoint: endpointOption,
  ...jsonColorOptions,
});

type Props = { args: zod.infer<typeof args>; options: zod.infer<typeof options> };

export default function LinksUpdate({ args: parsedArgs, options: parsedOptions }: Props) {
  return (
    <RunCommand
      label="Updating link"
      json={parsedOptions.json}
      updateCheck={parsedOptions.updateCheck}
      action={(command) => runLinksUpdate(parsedArgs[0], parsedOptions as LinksUpdateOptions, command)}
    />
  );
}
