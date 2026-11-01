'use client';

import { useEffect, useRef, useState } from 'react';
import type { FormEvent } from 'react';
import { createPortal } from 'react-dom';
import { Streamdown } from 'streamdown';
import type { MathPlugin } from 'streamdown';
import rehypeKatex from 'rehype-katex';
import remarkMath from 'remark-math';
import { toast } from 'sonner';
import {
  CodeBlock,
  InlineCode,
  MarkdownTable,
  MarkdownTableBody,
  MarkdownTableDataCell,
  MarkdownTableHead,
  MarkdownTableHeaderCell,
  MarkdownTableRow,
} from '@/components/markdown';
import { cn } from '@/lib/utils';

type OverlayMessage = {
  id: string;
  role: 'user' | 'assistant';
  content: string;
};

type NoteAiOverlayProps = {
  username: string;
  slug: string;
  title?: string;
  animate?: boolean;
};

const AI_STORAGE_VERSION = 1;

const streamdownMathPlugin: MathPlugin = {
  name: 'katex',
  type: 'math',
  remarkPlugin: remarkMath,
  rehypePlugin: [
    rehypeKatex,
    { strict: 'warn', throwOnError: false, trust: false, output: 'mathml' },
  ],
};

const looseMathPattern = /\(([^()\n]*(?:\\[a-zA-Z]+|[_^{}=+\-*/]|[∫√π∞])[^()\n]*)\)/g;
const bareCodeFencePattern = /(^|\n)```[ \t]*\n([\s\S]*?)\n```(?=\n|$)/g;
const codeFencePartPattern = /```([A-Za-z0-9_-]+)?[ \t]*\n([\s\S]*?)\n```/g;

function createId(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

function normalizeBareCodeFences(content: string): string {
  return content.replace(bareCodeFencePattern, (match, prefix: string, code: string) => {
    const language = inferCodeLanguage(code);
    if (language === 'text') {
      return match;
    }

    return `${prefix}\`\`\`${language}\n${code}\n\`\`\``;
  });
}

function normalizeLooseMath(content: string): string {
  const withCodeLanguages = normalizeBareCodeFences(content);
  const segments = withCodeLanguages.split(
    /(```[\s\S]*?```|`[^`\n]*`|\$\$[\s\S]*?\$\$|\$[^$\n]*\$)/g
  );

  return segments
    .map((segment, index) => {
      if (index % 2 === 1) {
        return segment;
      }

      return segment.replace(looseMathPattern, (_match, expression: string) => {
        return `$${expression.trim()}$`;
      });
    })
    .join('');
}

function inferCodeLanguage(content: string, explicitLanguage?: string): string {
  if (explicitLanguage && explicitLanguage !== 'text') {
    return explicitLanguage;
  }

  if (/\b(console\.log|const|let|var|function|import|export|=>)\b/.test(content)) {
    return 'javascript';
  }

  return explicitLanguage || 'text';
}

function splitMarkdownParts(
  content: string
): Array<
  { type: 'markdown'; content: string } | { type: 'code'; content: string; language: string }
> {
  const normalized = normalizeLooseMath(content);
  const parts: Array<
    { type: 'markdown'; content: string } | { type: 'code'; content: string; language: string }
  > = [];
  let lastIndex = 0;

  for (const match of normalized.matchAll(codeFencePartPattern)) {
    const index = match.index ?? 0;
    const before = normalized.slice(lastIndex, index);

    if (before) {
      parts.push({ type: 'markdown', content: before });
    }

    const code = match[2] ?? '';
    parts.push({
      type: 'code',
      content: code,
      language: inferCodeLanguage(code, match[1]),
    });
    lastIndex = index + match[0].length;
  }

  const after = normalized.slice(lastIndex);
  if (after) {
    parts.push({ type: 'markdown', content: after });
  }

  return parts.length ? parts : [{ type: 'markdown', content: normalized }];
}

function AiMarkdown({ content, className }: { content: string; className?: string }) {
  return (
    <>
      {splitMarkdownParts(content).map((part, index) => {
        if (part.type === 'code') {
          return (
            <CodeBlock key={`${index}-code`} language={part.language}>
              {part.content.replace(/\n$/, '')}
            </CodeBlock>
          );
        }

        return (
          <Streamdown
            key={`${index}-markdown`}
            className={cn(
              'prose prose-neutral prose-invert max-w-none break-words prose-p:my-1.5 prose-p:text-neutral-300 prose-headings:text-neutral-100 prose-ul:my-1.5 prose-ol:my-1.5 prose-li:my-0.5 prose-strong:text-neutral-100 prose-a:text-neutral-100 prose-a:decoration-neutral-700 prose-pre:my-1.5 prose-pre:max-w-full prose-pre:overflow-x-auto',
              className
            )}
            mode="streaming"
            plugins={{ math: streamdownMathPlugin }}
            components={{
              pre: ({ children }) => <>{children}</>,
              code: ({ children, ...props }) => <InlineCode {...props}>{children}</InlineCode>,
              inlineCode: ({ children, ...props }) => (
                <InlineCode {...props}>{children}</InlineCode>
              ),
              table: ({ children }) => <MarkdownTable>{children}</MarkdownTable>,
              thead: ({ children }) => <MarkdownTableHead>{children}</MarkdownTableHead>,
              tbody: ({ children }) => <MarkdownTableBody>{children}</MarkdownTableBody>,
              tr: ({ children }) => <MarkdownTableRow>{children}</MarkdownTableRow>,
              th: ({ children }) => <MarkdownTableHeaderCell>{children}</MarkdownTableHeaderCell>,
              td: ({ children }) => <MarkdownTableDataCell>{children}</MarkdownTableDataCell>,
            }}
          >
            {part.content}
          </Streamdown>
        );
      })}
    </>
  );
}

export function NoteAiOverlay({ username, slug, animate = false }: NoteAiOverlayProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [question, setQuestion] = useState('');
  const [messages, setMessages] = useState<OverlayMessage[]>([]);
  const [hasRestoredStorage, setHasRestoredStorage] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [panelWidth, setPanelWidth] = useState(0);
  const abortRef = useRef<AbortController | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const transcriptRef = useRef<HTMLDivElement | null>(null);
  const storageKey = `bri:note-ai:${username}:${slug}`;

  useEffect(() => {
    setMounted(true);
    try {
      const saved = Number(localStorage.getItem('bri:ai-panel-width'));
      if (Number.isFinite(saved) && saved >= 320) setPanelWidth(Math.min(saved, Math.max(320, window.innerWidth - 320)));
    } catch { /* keep the default width */ }
  }, []);

  useEffect(() => {
    const onResize = () => setPanelWidth((width) => width ? Math.min(width, Math.max(320, window.innerWidth - 320)) : 0);
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  useEffect(() => {
    if (panelWidth) document.documentElement.style.setProperty('--bri-ai-width', `${panelWidth}px`);
    return () => { document.documentElement.style.removeProperty('--bri-ai-width'); };
  }, [panelWidth]);

  useEffect(() => {
    document.body.classList.toggle('bri-ai-open', isOpen);
    return () => document.body.classList.remove('bri-ai-open');
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    const onEscape = (event: KeyboardEvent) => { if (event.key === 'Escape') setIsOpen(false); };
    window.addEventListener('keydown', onEscape);
    return () => window.removeEventListener('keydown', onEscape);
  }, [isOpen]);

  useEffect(() => {
    return () => abortRef.current?.abort();
  }, []);

  useEffect(() => {
    try {
      const raw = window.sessionStorage.getItem(storageKey);
      if (!raw) {
        setHasRestoredStorage(true);
        return;
      }

      const parsed = JSON.parse(raw) as {
        version?: number;
        question?: unknown;
        messages?: unknown;
        open?: unknown;
      };

      if (parsed.version !== AI_STORAGE_VERSION) {
        setHasRestoredStorage(true);
        return;
      }

      if (typeof parsed.question === 'string') {
        setQuestion(parsed.question.slice(0, 800));
      }
      if (typeof parsed.open === 'boolean') setIsOpen(parsed.open);

      if (Array.isArray(parsed.messages)) {
        const restoredMessages = parsed.messages
          .filter((message): message is OverlayMessage => {
            return (
              typeof message === 'object' &&
              message !== null &&
              'id' in message &&
              'role' in message &&
              'content' in message &&
              typeof message.id === 'string' &&
              (message.role === 'user' || message.role === 'assistant') &&
              typeof message.content === 'string'
            );
          })
          .slice(-20)
          .map((message) => ({
            ...message,
            content: message.content.slice(0, 8_000),
          }));

        setMessages(restoredMessages);
      }
    } catch {
      window.sessionStorage.removeItem(storageKey);
    } finally {
      setHasRestoredStorage(true);
    }
  }, [storageKey]);

  useEffect(() => {
    if (!hasRestoredStorage || !isOpen) {
      return;
    }

    const frame = window.requestAnimationFrame(() => {
      inputRef.current?.focus({ preventScroll: true });
    });

    return () => window.cancelAnimationFrame(frame);
  }, [hasRestoredStorage, isOpen, storageKey]);

  useEffect(() => {
    if (!hasRestoredStorage) {
      return;
    }

    try {
      const persistedMessages = messages.filter((message) => message.content.trim());
      window.sessionStorage.setItem(
        storageKey,
        JSON.stringify({
          version: AI_STORAGE_VERSION,
          question,
          messages: persistedMessages,
          open: isOpen,
        })
      );
    } catch {
      // Ignore quota/private-mode storage failures; chat still works for the current page.
    }
  }, [hasRestoredStorage, isOpen, messages, question, storageKey]);

  useEffect(() => {
    const transcript = transcriptRef.current;
    if (!transcript) {
      return;
    }
    transcript.scrollTop = transcript.scrollHeight;
  }, [messages, isOpen]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const trimmed = question.trim();
    if (!trimmed || isLoading) {
      return;
    }

    const userMessage: OverlayMessage = { id: createId(), role: 'user', content: trimmed };
    const assistantId = createId();
    setIsOpen(true);
    setMessages((current) => [
      ...current,
      userMessage,
      { id: assistantId, role: 'assistant', content: '' },
    ]);
    setQuestion('');
    setIsLoading(true);

    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    try {
      const response = await fetch(
        `/api/notes/${encodeURIComponent(username)}/${encodeURIComponent(slug)}/ask`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ question: trimmed, history: messages.filter((message) => message.content.trim()).slice(-12).map(({ role, content }) => ({ role, content: content.slice(0, 1_200) })) }),
          signal: controller.signal,
        }
      );

      if (!response.ok || !response.body) {
        let errorMessage = `AI request failed (${response.status})`;
        try {
          const parsed = (await response.json()) as { error?: string };
          errorMessage = parsed.error || errorMessage;
        } catch {
          // Keep generic status message when response is not JSON.
        }
        throw new Error(errorMessage);
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();

      while (true) {
        const { done, value } = await reader.read();
        if (done) {
          break;
        }

        const chunk = decoder.decode(value, { stream: true });
        setMessages((current) =>
          current.map((message) =>
            message.id === assistantId
              ? { ...message, content: `${message.content}${chunk}` }
              : message
          )
        );
      }
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') {
        return;
      }

      const message = error instanceof Error ? error.message : 'AI request failed';
      toast.error(message);
      setMessages((current) =>
        current.map((item) =>
          item.id === assistantId && !item.content ? { ...item, content: message } : item
        )
      );
    } finally {
      setIsLoading(false);
    }
  }

  const hasTranscript = messages.length > 0;

  return (
    <>
      {!isOpen && <button type="button" className="bri-ai-launcher" onClick={() => setIsOpen(true)}>ask ai</button>}
      {mounted && createPortal(
        <aside className={cn('bri-ai-panel flex flex-col border-l border-border bg-background text-foreground', animate && 'bri-ai-public')} data-open={isOpen} aria-label="Ask AI" aria-hidden={!isOpen} inert={!isOpen}>
          <div className="bri-ai-resizer" role="separator" aria-label="Resize Ask AI panel" aria-orientation="vertical" aria-valuemin={320} aria-valuemax={Math.max(320, window.innerWidth - 320)} aria-valuenow={panelWidth || Math.round(window.innerWidth / 2)} tabIndex={0}
            onKeyDown={(event) => {
              if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return;
              event.preventDefault();
              const next = Math.max(320, Math.min(window.innerWidth - 320, (panelWidth || window.innerWidth / 2) + (event.key === 'ArrowLeft' ? 24 : -24)));
              setPanelWidth(next);
              try { localStorage.setItem('bri:ai-panel-width', String(next)); } catch { /* keep the current width */ }
            }}
            onPointerDown={(event) => { event.currentTarget.setPointerCapture(event.pointerId); }}
            onPointerMove={(event) => {
              if (event.currentTarget.hasPointerCapture(event.pointerId)) setPanelWidth(Math.max(320, Math.min(window.innerWidth - 320, window.innerWidth - event.clientX)));
            }}
            onPointerUp={(event) => {
              if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
              const next = Math.max(320, Math.min(window.innerWidth - 320, window.innerWidth - event.clientX));
              setPanelWidth(next);
              try { localStorage.setItem('bri:ai-panel-width', String(next)); } catch { /* keep the current width */ }
            }}
          />
          <header className="flex h-10 shrink-0 items-center justify-between border-b border-border px-5 font-mono text-xs">
            <span>ask ai</span>
            <button type="button" onClick={() => setIsOpen(false)} aria-label="Close Ask AI" className="text-muted-foreground hover:text-foreground">close</button>
          </header>
          <div ref={transcriptRef} className="bri-ai-conversation min-h-0 flex-1 overflow-y-auto px-5 py-5 sm:px-7" aria-live="polite">
            {hasTranscript ? (
              <div className="flex flex-col gap-4">
                {messages.map((message) => (
                  <div
                    key={message.id}
                    className={cn('max-w-full text-sm leading-6',
                      message.role === 'user'
                        ? 'ai-note-message-user ml-auto max-w-[90%] rounded-sm border border-neutral-800 px-2 py-1.5 text-[var(--fg)]'
                        : 'text-[var(--muted)]'
                    )}
                  >
                    {message.content ? (
                      <AiMarkdown
                        content={message.content}
                        className={
                          message.role === 'user'
                            ? 'prose-p:!my-0 prose-p:!leading-4 prose-pre:!my-0'
                            : undefined
                        }
                      />
                    ) : (
                      <span className="text-neutral-500">thinking...</span>
                    )}
                  </div>
                ))}
              </div>
            ) : <p className="text-sm text-muted-foreground">Ask about this note or how it connects to other notes.</p>}
          </div>
          <form onSubmit={handleSubmit} className="flex shrink-0 items-center gap-3 border-t border-border px-5 py-2.5 sm:px-7">
            <input
              ref={inputRef}
              value={question}
              onChange={(event) => setQuestion(event.target.value)}
              maxLength={800}
              className="ai-note-input h-7 min-w-0 flex-1 appearance-none border-0 bg-transparent px-0 text-sm text-[var(--fg)] shadow-none outline-none placeholder:text-[var(--muted)]"
              placeholder="Ask about this note…"
              aria-label="Ask AI about this note"
            />
            <button
              type="submit"
              disabled={!question.trim() || isLoading}
              className="shrink-0 px-1 font-mono text-sm text-[var(--muted)] transition-colors hover:text-[var(--fg)] disabled:cursor-not-allowed disabled:opacity-40"
              aria-label="Send question"
            >
              {isLoading ? '...' : '>'}
            </button>
          </form>
        </aside>, document.body)}
    </>
  );
}

export function NoteAiOverlaySkeleton() {
  return (
    <div aria-hidden="true" className="bri-ai-launcher pointer-events-none">ask ai</div>
  );
}
