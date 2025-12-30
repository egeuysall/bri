'use client';

import { useState } from 'react';
import { CodeBlock } from '@/components/markdown/code-block';
import { Button } from '@/components/ui/button';
import { Copy, Check } from 'lucide-react';

function CopyButton({ installCommand }: { installCommand: string }) {
  const [copied, setCopied] = useState<boolean>(false);

  const handleCopyCommand = () => {
    navigator.clipboard.writeText(installCommand);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <Button
      type="button"
      onClick={handleCopyCommand}
      className="absolute right-2 top-1/2 -translate-y-1/2 rounded-md bg-neutral-100 p-2 backdrop-blur-sm dark:bg-neutral-700"
      variant="ghost"
      size="icon"
    >
      {copied ? <Check className="h-4 w-4 text-green-600" /> : <Copy className="h-4 w-4" />}
    </Button>
  );
}

export function CliSection() {
  const installCommand = 'go install github.com/egeuysall/bridge/backend/cmd/bridge@master';

  return (
    <div className="mx-auto w-full max-w-2/3">
      <div className="relative">
        <CodeBlock language="bash">{installCommand}</CodeBlock>
        <CopyButton installCommand={installCommand} />
      </div>
    </div>
  );
}
