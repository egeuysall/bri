import { CodeBlock } from '@/components/markdown/code-block';
import { CliMotionPreview } from '@/components/blocks/cli-motion-preview';
import { getInstallCommand } from '@/lib/site-url';

export function CliSection() {
  const installCommand = getInstallCommand();

  return (
    <div className="w-full space-y-7">
      <p className="text-sm text-neutral-300">CLI</p>
      <CodeBlock language="bash">{installCommand}</CodeBlock>
      <CliMotionPreview />
    </div>
  );
}
