import zod from 'zod';
import { runDoctor } from '../actions/system';
import { RunCommand } from '../core/pastel';
import { endpointOption, jsonColorOptions } from '../core/schemas';
import type { DoctorOptions } from '../core/shared';

export const description = 'Run local runtime checks';

export const options = zod.object({
  endpoint: endpointOption,
  ...jsonColorOptions,
});

type Props = {
  options: zod.infer<typeof options>;
};

export default function Doctor({ options: parsedOptions }: Props) {
  return (
    <RunCommand
      label="Checking runtime"
      json={parsedOptions.json}
      updateCheck={parsedOptions.updateCheck}
      action={(command) => runDoctor(parsedOptions as DoctorOptions, command)}
    />
  );
}
