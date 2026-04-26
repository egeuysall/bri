import zod from 'zod';
import { runSelfUpdate } from '../actions/system';
import { RunCommand } from '../core/pastel';
import { colorOption, jsonOption, quietOption, updateCheckOption } from '../core/schemas';
import type { SelfUpdateOptions } from '../core/shared';

export const description = 'Check for and reinstall latest bun-runtime release';

export const options = zod.object({
  checkOnly: zod.boolean().describe('Only report whether an update is available'),
  yes: zod.boolean().describe('Non-interactive mode for scripts'),
  quiet: quietOption,
  json: jsonOption,
  color: colorOption,
  updateCheck: updateCheckOption,
});

type Props = {
  options: zod.infer<typeof options>;
};

export default function SelfUpdate({ options: parsedOptions }: Props) {
  return (
    <RunCommand
      label="Checking release"
      quiet={parsedOptions.quiet}
      json={parsedOptions.json}
      skipUpdateCheck
      action={(command) => runSelfUpdate(parsedOptions as SelfUpdateOptions, command)}
    />
  );
}
