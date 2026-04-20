import { CodeBlock } from '@/components/markdown/code-block';

export function CliSection() {
  const installCommand = 'curl -fsSL https://bri.egeuysal.com/install.sh | bash';

  return (
    <div className="w-full">
      <CodeBlock language="bash">{installCommand}</CodeBlock>
    </div>
  );
}
