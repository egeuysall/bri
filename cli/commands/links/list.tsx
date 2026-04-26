import zod from 'zod';
import { runLinksList } from '../../actions/resources';
import { RunCommand } from '../../core/pastel';
import { endpointOption, jsonColorOptions } from '../../core/schemas';
import type { LinksListOptions } from '../../core/shared';

export const description = 'List quick links';

export const options = zod.object({
  endpoint: endpointOption,
  ...jsonColorOptions,
});

type Props = { options: zod.infer<typeof options> };

export default function LinksList({ options: parsedOptions }: Props) {
  return (
    <RunCommand
      label="Loading links"
      json={parsedOptions.json}
      updateCheck={parsedOptions.updateCheck}
      action={(command) => runLinksList(parsedOptions as LinksListOptions, command)}
    />
  );
}
