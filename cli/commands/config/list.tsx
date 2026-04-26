import zod from 'zod';
import { runConfigList } from '../../actions/system';
import { RunCommand } from '../../core/pastel';
import { jsonOption, updateCheckOption } from '../../core/schemas';
import type { ConfigOptions } from '../../core/shared';

export const description = 'Show local defaults';

export const options = zod.object({
  json: jsonOption,
  updateCheck: updateCheckOption,
});

type Props = { options: zod.infer<typeof options> };

export default function ConfigList({ options: parsedOptions }: Props) {
  return (
    <RunCommand
      label="Reading config"
      json={parsedOptions.json}
      updateCheck={parsedOptions.updateCheck}
      action={async () => runConfigList(parsedOptions as ConfigOptions)}
    />
  );
}
