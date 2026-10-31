import { BriCliTerminal } from '@/components/blocks/bri-cli-terminal';
import { getInstallCommand } from '@/lib/site-url';

export function CliSection() {
  const installCommand = getInstallCommand();

  return (
    <div className="w-full space-y-3">
      <div>
        <h2 className="text-sm font-semibold leading-5 text-neutral-100">try the cli</h2>
        <p className="mt-1 text-xs leading-5 text-muted-foreground">try bri --help or bri notes list. commands run in an isolated demo account, not your own.</p>
      </div>
      <BriCliTerminal installCommand={installCommand} />
    </div>
  );
}
