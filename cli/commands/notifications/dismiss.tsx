import { argument } from 'pastel';
import zod from 'zod';
import { runNotificationsDismiss } from '../../actions/resources';
import { RunCommand } from '../../core/pastel';
import { endpointOption, jsonColorOptions } from '../../core/schemas';
import type { NotificationsActionOptions } from '../../core/shared';

export const description = 'Dismiss notification';

export const args = zod.tuple([zod.string().describe(argument({ name: 'id', description: 'Notification ID' }))]);

export const options = zod.object({
  endpoint: endpointOption,
  ...jsonColorOptions,
});

type Props = { args: zod.infer<typeof args>; options: zod.infer<typeof options> };

export default function NotificationsDismiss({ args: parsedArgs, options: parsedOptions }: Props) {
  return (
    <RunCommand
      label="Dismissing notification"
      json={parsedOptions.json}
      updateCheck={parsedOptions.updateCheck}
      action={(command) =>
        runNotificationsDismiss(parsedArgs[0], parsedOptions as NotificationsActionOptions, command)
      }
    />
  );
}
