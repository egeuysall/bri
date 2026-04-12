import { CodeBlock } from '@/components/markdown/code-block';

export function CliSection() {
  const installCommand = 'go install github.com/egeuysall/bridge/backend/cmd/bridge@master';

  return (
    <div className="w-full">
      <CodeBlock language="bash">{installCommand}</CodeBlock>
    </div>
  );
}
