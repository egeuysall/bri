import { argument } from 'pastel';
import zod from 'zod';
import { runInvite } from '../../actions/resources';
import { RunCommand } from '../../core/pastel';
import { endpointOption, jsonColorOptions } from '../../core/schemas';
import type { InviteOptions } from '../../core/shared';

export const description = 'Invite a user to a quick link';

export const args = zod.tuple([zod.string().describe(argument({ name: 'id', description: 'Quick link ID' }))]);

export const options = zod.object({
  username: zod.string().describe('Invitee username'),
  endpoint: endpointOption,
  ...jsonColorOptions,
});

type Props = { args: zod.infer<typeof args>; options: zod.infer<typeof options> };

export default function LinksInvite({ args: parsedArgs, options: parsedOptions }: Props) {
  return (
    <RunCommand
      label="Inviting user"
      json={parsedOptions.json}
      updateCheck={parsedOptions.updateCheck}
      action={(command) => runInvite('link', parsedArgs[0], parsedOptions as InviteOptions, command)}
    />
  );
}
