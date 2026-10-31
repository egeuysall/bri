import { BriCliTerminal } from '@/components/blocks/bri-cli-terminal';
import { getInstallCommand } from '@/lib/site-url';

export function CliSection() {
  const installCommand = getInstallCommand();

  return (
    <div className="w-full space-y-3">
      <h2 className="text-sm font-semibold leading-5 text-neutral-100">cli</h2>
      <BriCliTerminal installCommand={installCommand} />
    </div>
  );
}
