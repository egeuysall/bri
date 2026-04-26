import zod from 'zod';
import { runLogin } from '../actions/system';
import { RunCommand } from '../core/pastel';
import { updateCheckOption } from '../core/schemas';
import type { LoginOptions } from '../core/shared';

export const description = 'Store API key for authenticated CLI operations';

export const options = zod.object({
  apiKey: zod.string().describe('API key value'),
  username: zod.string().optional().describe('Default username for dry-run links'),
  updateCheck: updateCheckOption,
});

type Props = {
  options: zod.infer<typeof options>;
};

export default function Login({ options: parsedOptions }: Props) {
  return (
    <RunCommand
      label="Saving auth"
      updateCheck={parsedOptions.updateCheck}
      action={async () => runLogin(parsedOptions as LoginOptions)}
    />
  );
}
