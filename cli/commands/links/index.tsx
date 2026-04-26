import { RunCommand } from '../../core/pastel';
import { renderPanel } from '../../core/ui';

export const description = 'Quick links CRUD operations';

export default function Links() {
  return (
    <RunCommand
      label="Loading links"
      skipUpdateCheck
      action={async () =>
        renderPanel({
          title: 'bri links',
          enableColor: process.stdout.isTTY,
          rows: [
            { label: 'commands', value: 'list, create, update, delete, invite', tone: 'info' },
            { label: 'help', value: 'bri links --help', tone: 'muted' },
          ],
        })
      }
    />
  );
}
