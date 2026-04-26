import { argument } from 'pastel';
import zod from 'zod';
import { CONFIG_KEYS, runConfigSet } from '../../actions/system';
import { RunCommand } from '../../core/pastel';
import { updateCheckOption } from '../../core/schemas';

export const description = 'Save local config value';

export const args = zod.tuple([
  zod.string().describe(argument({ name: 'key', description: `One of: ${CONFIG_KEYS.join(', ')}` })),
  zod.string().describe(argument({ name: 'value', description: 'Value to save' })),
]);

export const options = zod.object({
  updateCheck: updateCheckOption,
});

type Props = { args: zod.infer<typeof args>; options: zod.infer<typeof options> };

export default function ConfigSet({ args: parsedArgs, options: parsedOptions }: Props) {
  return (
    <RunCommand
      label="Saving config"
      updateCheck={parsedOptions.updateCheck}
      action={async () => runConfigSet(parsedArgs[0], parsedArgs[1])}
    />
  );
}
