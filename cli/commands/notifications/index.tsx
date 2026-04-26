import { RunCommand } from '../../core/pastel';
import { renderPanel } from '../../core/ui';

export const description = 'Notifications inbox';

export default function Notifications() {
  return (
    <RunCommand
      label="Loading notifications"
      skipUpdateCheck
      action={async () =>
        renderPanel({
          title: 'bri notifications',
          enableColor: process.stdout.isTTY,
          rows: [
            { label: 'commands', value: 'list, open, dismiss', tone: 'info' },
            { label: 'help', value: 'bri notifications --help', tone: 'muted' },
          ],
        })
      }
    />
  );
}
