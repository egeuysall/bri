import zod from 'zod';
import { runLogout } from '../actions/system';
import { RunCommand } from '../core/pastel';
import { updateCheckOption } from '../core/schemas';

export const description = 'Remove stored API key';

export const options = zod.object({
  updateCheck: updateCheckOption,
});

type Props = {
  options: zod.infer<typeof options>;
};

export default function Logout({ options: parsedOptions }: Props) {
  return <RunCommand label="Removing auth" updateCheck={parsedOptions.updateCheck} action={async () => runLogout()} />;
}
