import { RunCommand } from '../core/pastel';
import { renderTopHelp } from '../core/shared';

export const description = 'Publish markdown notes, quick links, and notifications from terminal';

export default function Index() {
  return <RunCommand label="Loading" skipUpdateCheck action={async () => renderTopHelp(process.stdout.isTTY)} />;
}
