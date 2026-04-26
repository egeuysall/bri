import zod from 'zod';
import { runNotificationsList } from '../../actions/resources';
import { RunCommand } from '../../core/pastel';
import { endpointOption, jsonColorOptions } from '../../core/schemas';
import type { NotificationsListOptions } from '../../core/shared';

export const description = 'List notifications';

export const options = zod.object({
  endpoint: endpointOption,
  ...jsonColorOptions,
});

type Props = { options: zod.infer<typeof options> };

export default function NotificationsList({ options: parsedOptions }: Props) {
  return (
    <RunCommand
      label="Loading notifications"
      json={parsedOptions.json}
      updateCheck={parsedOptions.updateCheck}
      action={(command) => runNotificationsList(parsedOptions as NotificationsListOptions, command)}
    />
  );
}
