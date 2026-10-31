'use client';

import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { CodeBlock, CodeBlockActions, CodeBlockContent, CodeBlockLine } from '@/components/ui/code-block';
import { useHighlightedCode } from '@/hooks/use-highlighted-code';
import { CliAnsiOutput } from '@/components/blocks/cli-ansi-output';

type Entry = { command: string; output: string };
type ShellBuiltin = 'clear' | 'history' | 'help' | 'exit';
const terminalStorageKey = 'bri:landing-cli:v1';
const terminalWidthKey = 'bri:landing-cli-width:v1';
const minPanelWidth = 320;

function clampPanelWidth(width: number) {
  const viewportWidth = window.innerWidth;
  const minWidth = Math.min(minPanelWidth, Math.max(280, viewportWidth - 280));
  const maxWidth = Math.max(minWidth, Math.min(viewportWidth * 0.8, viewportWidth - 320));
  return Math.round(Math.min(maxWidth, Math.max(minWidth, width)));
}

function tokenizeCommandLine(value: string): string[] | null {
  const tokens: string[] = [];
  let token = '';
  let quote: "'" | '"' | null = null;
  let escaped = false;
  let active = false;

  for (const character of value.trim()) {
    if (escaped) {
      token += character;
      escaped = false;
      active = true;
    } else if (character === '\\' && quote !== "'") {
      escaped = true;
      active = true;
    } else if (quote) {
      if (character === quote) quote = null;
      else token += character;
      active = true;
    } else if (character === "'" || character === '"') {
      quote = character;
      active = true;
    } else if (/\s/.test(character)) {
      if (active) tokens.push(token);
      token = '';
      active = false;
    } else {
      token += character;
      active = true;
    }
  }

  if (quote || escaped) return null;
  if (active) tokens.push(token);
  return tokens;
}

function splitPipeline(value: string): [string, string | null] {
  let quote: "'" | '"' | null = null;
  let escaped = false;
  for (let index = 0; index < value.length; index += 1) {
    const character = value[index];
    if (escaped) { escaped = false; continue; }
    if (character === '\\' && quote !== "'") { escaped = true; continue; }
    if (quote) { if (character === quote) quote = null; continue; }
    if (character === "'" || character === '"') { quote = character; continue; }
    if (character === '|') return [value.slice(0, index).trim(), value.slice(index + 1).trim()];
  }
  return [value, null];
}

function getShellBuiltin(value: string): ShellBuiltin | null {
  const normalized = value.trim().toLowerCase();
  if (/^(?:bri\s+)?(?:clear|cls)$/.test(normalized)) return 'clear';
  if (/^(?:bri\s+)?history$/.test(normalized)) return 'history';
  if (normalized === 'help') return 'help';
  if (/^(?:bri\s+)?(?:exit|quit)$/.test(normalized)) return 'exit';
  return null;
}

function InstallCommand({ command }: { command: string }) {
  const lines = useHighlightedCode(command, 'bash');

  return (
    <CodeBlock className="mt-3 rounded-sm border border-border text-xs" size="sm" style={{ background: 'var(--code-highlight-bg)' }}>
      <CodeBlockActions>
        <button type="button" className="rounded-sm border border-border px-2 py-1 text-[10px] text-muted-foreground transition-colors hover:border-foreground hover:text-foreground" onClick={() => void navigator.clipboard.writeText(command)} aria-label="copy install command">copy</button>
      </CodeBlockActions>
      <CodeBlockContent wrap>
        {lines.map((line, index) => <CodeBlockLine key={index}>{line}</CodeBlockLine>)}
      </CodeBlockContent>
    </CodeBlock>
  );
}

function CliOutput({ output }: { output: string }) {
  return (
    <CodeBlock className="mt-1 rounded-none border-0 bg-transparent text-xs" style={{ background: 'transparent' }}>
      <CodeBlockContent wrap className="bg-transparent px-0 py-0" style={{ background: 'transparent' }}>
        <CliAnsiOutput output={output.toLowerCase()} />
      </CodeBlockContent>
    </CodeBlock>
  );
}

export function BriCliTerminal({ installCommand }: { installCommand: string }) {
  const [command, setCommand] = useState('');
  const [entries, setEntries] = useState<Entry[]>([]);
  const [history, setHistory] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [open, setOpen] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const workspaceInputRef = useRef<HTMLInputElement>(null);
  const restoreFocusRef = useRef(false);
  const historyRef = useRef<string[]>([]);
  const sessionIdRef = useRef<string | null>(null);
  const historyCursorRef = useRef(-1);
  const historyDraftRef = useRef('');
  const transcriptRef = useRef<HTMLDivElement>(null);
  const [panelWidth, setPanelWidth] = useState(0);
  const panelWidthRef = useRef(0);
  const hasSavedWidthRef = useRef(false);
  const [restored, setRestored] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    try {
      sessionStorage.removeItem(terminalStorageKey);
      sessionIdRef.current = crypto.randomUUID().replaceAll('-', '');
      const width = Number(localStorage.getItem(terminalWidthKey));
      hasSavedWidthRef.current = Number.isFinite(width) && width > 0;
      const initialWidth = window.innerWidth <= 640
        ? window.innerWidth
        : clampPanelWidth(hasSavedWidthRef.current ? width : window.innerWidth / 2);
      panelWidthRef.current = initialWidth;
      setPanelWidth(initialWidth);
    } catch {
      const initialWidth = window.innerWidth <= 640 ? window.innerWidth : clampPanelWidth(window.innerWidth / 2);
      panelWidthRef.current = initialWidth;
      setPanelWidth(initialWidth);
    }
    setRestored(true);
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!restored) return;
    try {
      sessionStorage.removeItem(terminalStorageKey);
    } catch { /* terminal continues without browser storage */ }
  }, [command, entries, history, open, restored]);

  useEffect(() => {
    document.body.classList.toggle('bri-cli-workspace-open', open);
    document.body.style.transition = 'margin-right 360ms cubic-bezier(.2, .75, .25, 1)';
    const syncPageWidth = () => {
      document.body.style.marginRight = open && window.innerWidth > 640 ? `${panelWidth}px` : '0px';
    };
    syncPageWidth();
    window.addEventListener('resize', syncPageWidth);
    if (panelWidth > 0) document.documentElement.style.setProperty('--cli-workspace-width', `${panelWidth}px`);
    return () => {
      window.removeEventListener('resize', syncPageWidth);
      document.body.classList.remove('bri-cli-workspace-open');
      document.body.style.marginRight = '';
      document.body.style.transition = '';
    };
  }, [open, panelWidth]);

  useEffect(() => {
    const onResize = () => {
      if (window.innerWidth <= 640) return;
      const nextWidth = hasSavedWidthRef.current ? clampPanelWidth(panelWidthRef.current) : Math.round(window.innerWidth / 2);
      panelWidthRef.current = nextWidth;
      setPanelWidth(nextWidth);
      if (hasSavedWidthRef.current) {
        try { localStorage.setItem(terminalWidthKey, String(nextWidth)); } catch { /* keep the current width */ }
      }
    };
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  useEffect(() => {
    if (transcriptRef.current) transcriptRef.current.scrollTop = transcriptRef.current.scrollHeight;
  }, [entries, busy]);

  function resizeTo(width: number) {
    const next = clampPanelWidth(width);
    panelWidthRef.current = next;
    setPanelWidth(next);
    hasSavedWidthRef.current = true;
    return next;
  }

  function finishResize() {
    document.body.classList.remove('bri-cli-workspace-resizing');
    try { localStorage.setItem(terminalWidthKey, String(panelWidthRef.current)); } catch { /* keep the current width */ }
  }

  function closeWorkspace() {
    restoreFocusRef.current = true;
    setOpen(false);
  }

  useEffect(() => {
    if (open) {
      workspaceInputRef.current?.focus();
    } else if (restoreFocusRef.current) {
      inputRef.current?.focus();
      restoreFocusRef.current = false;
    }
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        closeWorkspace();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [open]);

  async function run(value = command) {
    const normalized = value.trim();
    if (!normalized || busy) return;
    const builtin = getShellBuiltin(normalized);
    if (builtin) {
      const nextHistory = [...historyRef.current, normalized].slice(-100);
      historyRef.current = nextHistory;
      historyCursorRef.current = -1;
      setHistory(nextHistory);
      setCommand('');
      if (builtin === 'clear') {
        setEntries([]);
      } else if (builtin === 'exit') {
        setOpen(false);
      } else {
        const output = builtin === 'history'
          ? nextHistory.slice(0, -1).map((item, index) => `${String(index + 1).padStart(3, ' ')}  ${item}`).join('\n') || 'no commands yet.'
          : 'shell: clear, history, help, exit, pwd, ls, cat, touch, mkdir, rm, echo, printf, date, whoami, curl\nredirect echo/printf output with > or >>; cli: bri --help';
        setEntries((current) => [...current.slice(-5), { command: normalized, output }]);
      }
      return;
    }
    const [pipelineLeft, pipelineRight] = splitPipeline(normalized);
    const leftArgs = pipelineRight ? tokenizeCommandLine(pipelineLeft ?? '') : null;
    const commandArgs = pipelineRight ? tokenizeCommandLine(pipelineRight) : tokenizeCommandLine(normalized);
    const nextHistory = [...historyRef.current, normalized].slice(-100);
    historyRef.current = nextHistory;
    historyCursorRef.current = -1;
    setHistory(nextHistory);
    let stdin: string | undefined;
    if (leftArgs?.[0] === 'echo') stdin = leftArgs.slice(1).join(' ');
    if (leftArgs?.[0] === 'printf') {
      const [format = '', ...values] = leftArgs.slice(1);
      let valueIndex = 0;
      stdin = format.replace(/%[sdif]/g, () => values[valueIndex++] ?? '')
        .replace(/\\n/g, '\n').replace(/\\t/g, '\t').replace(/\\r/g, '\r');
    }
    if (!commandArgs || (pipelineRight && (!leftArgs || stdin === undefined || !['echo', 'printf'].includes(leftArgs[0] ?? '') || commandArgs[0]?.toLowerCase() !== 'bri' || commandArgs[1]?.toLowerCase() !== 'notes' || commandArgs[2]?.toLowerCase() !== 'update' || !commandArgs.includes('--stdin')))) {
      setEntries((current) => [...current.slice(-5), {
        command: normalized,
        output: 'enter a complete command. quotes group text; commands run in the demo environment.',
      }]);
      return;
    }
    setBusy(true);
    setCommand('');
    const sessionId = sessionIdRef.current ?? (sessionIdRef.current = crypto.randomUUID().replaceAll('-', ''));
    try {
      const response = await fetch('/api/landing-cli', {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'x-bri-demo-session': sessionId },
        body: JSON.stringify({ args: commandArgs, ...(stdin !== undefined ? { stdin } : {}) }),
      });
      const result = await response.json();
      setEntries((current) => [...current.slice(-5), { command: normalized, output: result.output ?? result.error ?? 'no output.' }]);
      if (commandArgs[0]?.toLowerCase() === 'bri') {
        window.dispatchEvent(new CustomEvent('bri:landing-workspace-updated', { detail: { sessionId } }));
      }
    } catch {
      setEntries((current) => [...current.slice(-5), { command: normalized, output: 'could not reach the cli runner.' }]);
    } finally {
      setBusy(false);
      workspaceInputRef.current?.focus();
    }
  }

  function handleInputKeyDown(event: React.KeyboardEvent<HTMLInputElement>) {
    if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'l') {
      event.preventDefault();
      setOpen(true);
      void run('clear');
      return;
    }
    if (event.key === 'ArrowUp' || event.key === 'ArrowDown') {
      const commands = historyRef.current;
      if (!commands.length) return;
      event.preventDefault();
      if (event.key === 'ArrowUp') {
        if (historyCursorRef.current === -1) historyDraftRef.current = event.currentTarget.value;
        historyCursorRef.current = Math.min(commands.length - 1, historyCursorRef.current + 1);
      } else if (historyCursorRef.current >= 0) {
        historyCursorRef.current -= 1;
      } else {
        return;
      }
      const cursor = historyCursorRef.current;
      setCommand(cursor < 0 ? historyDraftRef.current : commands[commands.length - 1 - cursor] ?? '');
    }
  }

  return (
    <div className="w-full">
      <InstallCommand command={installCommand} />
      <form
        className="mt-3 flex items-baseline gap-2 font-mono text-[13px]"
        onSubmit={(event) => { event.preventDefault(); if (!command.trim()) return; setOpen(true); void run(); }}
      >
        <span className="text-xs text-muted-foreground">$</span>
        <input
          ref={inputRef}
          aria-label="try a bri cli command"
          autoComplete="off"
          className="min-w-0 flex-1 !border-0 bg-transparent font-mono text-[13px] text-foreground !outline-none !shadow-none placeholder:text-muted-foreground focus-visible:!border-0 focus-visible:!outline-none focus-visible:!shadow-none"
          placeholder="bri --help"
          value={command}
          onChange={(event) => { historyCursorRef.current = -1; setCommand(event.target.value); }}
          onKeyDown={handleInputKeyDown}
        />
      </form>

      {mounted && createPortal((
        <aside
          aria-label="bri cli workspace"
          aria-hidden={!open}
          inert={!open}
          data-open={open}
          className="cli-workspace-panel fixed inset-y-0 right-0 z-50 flex w-full flex-col border-l border-border bg-background text-foreground md:w-[var(--cli-workspace-width,50vw)]"
          style={{ width: 'var(--cli-workspace-width, 50vw)' }}
        >
          <div className="cli-workspace-resizer" role="separator" aria-label="resize terminal" aria-orientation="vertical" aria-valuemin={minPanelWidth} aria-valuenow={panelWidth} tabIndex={0}
            onKeyDown={(event) => {
              if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return;
              event.preventDefault();
              const direction = event.key === 'ArrowLeft' ? 1 : -1;
              const next = resizeTo(panelWidth + direction * 24);
              try { localStorage.setItem(terminalWidthKey, String(next)); } catch { /* keep the current width */ }
            }}
            onPointerDown={(event) => {
              if (window.innerWidth <= 640) return;
              event.preventDefault();
              event.currentTarget.setPointerCapture(event.pointerId);
              document.body.classList.add('bri-cli-workspace-resizing');
            }}
            onPointerMove={(event) => { if (event.currentTarget.hasPointerCapture(event.pointerId)) resizeTo(window.innerWidth - event.clientX); }}
            onPointerUp={(event) => { if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId); finishResize(); }}
            onPointerCancel={finishResize}
            onLostPointerCapture={finishResize}
          />
          <header className="flex h-12 shrink-0 items-center justify-between border-b border-border px-4 font-mono text-xs">
            <div className="flex h-full items-stretch gap-5">
              <span className="flex items-center border-b border-foreground px-1 text-foreground">terminal</span>
              <a className="flex items-center text-muted-foreground hover:text-foreground" href="/docs" target="_blank" rel="noreferrer">all commands</a>
            </div>
            <button className="text-muted-foreground hover:text-foreground" type="button" onClick={closeWorkspace} aria-label="close cli workspace">close</button>
          </header>

          <div ref={transcriptRef} className="flex-1 overflow-y-auto px-5 py-5 font-mono text-xs leading-5 sm:px-7" aria-live="polite">
            <p className="mb-5 text-muted-foreground">bri · cli workspace</p>
            {entries.length === 0 && <p className="text-muted-foreground">run any command from the current cli, starting with `bri`.</p>}
            <div className="space-y-4">
              {entries.map((entry, index) => (
                <div key={`${entry.command}-${index}`}>
                  <p className="text-foreground">$ {entry.command}</p>
                  <CliOutput output={entry.output} />
                  <div className="sr-only" data-cli-command={entry.command} />
                </div>
              ))}
              {busy && <p className="text-muted-foreground">running…</p>}
            </div>
          </div>
          <form className="flex shrink-0 items-center gap-3 border-t border-border px-5 py-4 font-mono text-[13px] sm:px-7" onSubmit={(event) => { event.preventDefault(); void run(); }}>
            <span className="text-xs text-muted-foreground">$</span>
            <input ref={workspaceInputRef} aria-label="cli command" autoComplete="off" className="min-w-0 flex-1 !border-0 bg-transparent font-mono text-[13px] text-foreground !outline-none !shadow-none placeholder:text-muted-foreground focus-visible:!border-0 focus-visible:!outline-none focus-visible:!shadow-none" placeholder="bri --help" value={command} onChange={(event) => { historyCursorRef.current = -1; setCommand(event.target.value); }} onKeyDown={handleInputKeyDown} />
            <button className="text-xs text-foreground hover:text-muted-foreground disabled:opacity-50" disabled={busy || !command.trim()} type="submit">run</button>
          </form>
        </aside>
      ), document.body)}
    </div>
  );
}
