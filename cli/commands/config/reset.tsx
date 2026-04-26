import zod from 'zod';
import { runConfigReset } from '../../actions/system';
import { RunCommand } from '../../core/pastel';
import { updateCheckOption } from '../../core/schemas';

export const description = 'Clear all config values';

export const options = zod.object({
  updateCheck: updateCheckOption,
});

type Props = { options: zod.infer<typeof options> };

export default function ConfigReset({ options: parsedOptions }: Props) {
  return (
    <RunCommand
      label="Resetting config"
      updateCheck={parsedOptions.updateCheck}
      action={async () => runConfigReset()}
    />
  );
}
