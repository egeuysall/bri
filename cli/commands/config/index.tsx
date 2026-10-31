import { RunCommand } from '../../core/pastel';
import { isColorEnabled } from '../../core/shared';
import { renderPanel } from '../../core/ui';

export const description = 'Manage persistent bri config';

export default function Config() {
  return (
    <RunCommand
      label="Loading config"
      skipUpdateCheck
      action={async () =>
        renderPanel({
          title: 'bri config',
          enableColor: isColorEnabled,
          rows: [
            { label: 'commands', value: 'list, set, unset, reset', tone: 'info' },
            { label: 'help', value: 'bri config --help', tone: 'muted' },
          ],
        })
      }
    />
  );
}
