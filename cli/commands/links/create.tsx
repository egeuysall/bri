import zod from 'zod';
import { runLinksCreate } from '../../actions/resources';
import { RunCommand } from '../../core/pastel';
import { endpointOption, jsonColorOptions } from '../../core/schemas';
import type { LinksCreateOptions } from '../../core/shared';

export const description = 'Create quick link';

export const options = zod.object({
  key: zod.string().describe('Link key'),
  target: zod.string().describe('Target URL'),
  label: zod.string().optional().describe('Optional label'),
  endpoint: endpointOption,
  ...jsonColorOptions,
});

type Props = { options: zod.infer<typeof options> };

export default function LinksCreate({ options: parsedOptions }: Props) {
  return (
    <RunCommand
      label="Creating link"
      json={parsedOptions.json}
      updateCheck={parsedOptions.updateCheck}
      action={(command) => runLinksCreate(parsedOptions as LinksCreateOptions, command)}
    />
  );
}
