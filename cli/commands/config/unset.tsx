import { argument } from 'pastel';
import zod from 'zod';
import { CONFIG_KEYS, runConfigUnset } from '../../actions/system';
import { RunCommand } from '../../core/pastel';
import { updateCheckOption } from '../../core/schemas';

export const description = 'Remove local config value';

export const args = zod.tuple([
  zod.string().describe(argument({ name: 'key', description: `One of: ${CONFIG_KEYS.join(', ')}` })),
]);

export const options = zod.object({
  updateCheck: updateCheckOption,
});

type Props = { args: zod.infer<typeof args>; options: zod.infer<typeof options> };

export default function ConfigUnset({ args: parsedArgs, options: parsedOptions }: Props) {
  return (
    <RunCommand
      label="Removing config"
      updateCheck={parsedOptions.updateCheck}
      action={async () => runConfigUnset(parsedArgs[0])}
    />
  );
}
