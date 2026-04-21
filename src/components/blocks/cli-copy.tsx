import { CodeBlock } from '@/components/markdown/code-block';
import { CliMotionPreview } from '@/components/blocks/cli-motion-preview';

export function CliSection() {
  const installCommand = 'curl -fsSL https://bri.egeuysal.com/install.sh | bash';

  return (
    <div className="w-full space-y-7">
      <p className="text-sm text-neutral-300">CLI</p>
      <CodeBlock language="bash">{installCommand}</CodeBlock>
      <CliMotionPreview />
    </div>
  );
}
