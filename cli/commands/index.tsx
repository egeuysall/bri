import { RunCommand } from '../core/pastel';
import { isColorEnabled, renderTopHelp } from '../core/shared';

export const description = 'Publish markdown notes, quick links, and notifications from terminal';

export default function Index() {
  return <RunCommand label="Loading" skipUpdateCheck action={async () => renderTopHelp(isColorEnabled)} />;
}
