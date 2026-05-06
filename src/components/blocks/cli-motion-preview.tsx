'use client';

import { useEffect, useState } from 'react';
import { cn } from '@/lib/utils';

type DemoPanelId = 'notes' | 'links' | 'settings';

type DemoRow = {
  id: string;
  title: string;
  meta: string;
  detail: string;
};

type DemoPanel = {
  id: DemoPanelId;
  title: string;
  path: string;
  stat: string;
  caption: string;
  rows: DemoRow[];
  terminal: string[];
};

const PANEL_INTERVAL_MS = 3200;
const ROW_INTERVAL_MS = 1400;

const demoPanels: DemoPanel[] = [
  {
    id: 'notes',
    title: 'notes',
    path: '/dashboard?tab=notes',
    stat: '12 active',
    caption: 'Publish and track note traffic.',
    rows: [
      {
        id: 'n-1',
        title: 'launch-notes',
        meta: 'public',
        detail: '412 views this month',
      },
      {
        id: 'n-2',
        title: 'ship-log',
        meta: 'private',
        detail: 'updated 2h ago',
      },
      {
        id: 'n-3',
        title: 'status-page',
        meta: 'public',
        detail: 'expires in 7d',
      },
    ],
    terminal: [
      '$ bri note create --title "launch-notes"',
      'created /egeuysall/launch-notes',
      '$ bri note analytics --days 30',
      'launch-notes: 412 views',
    ],
  },
  {
    id: 'links',
    title: 'links',
    path: '/dashboard?tab=links',
    stat: '6 links',
    caption: 'Pin short links and watch click counts.',
    rows: [
      {
        id: 'l-1',
        title: '/yt',
        meta: 'quick link',
        detail: '184 clicks',
      },
      {
        id: 'l-2',
        title: '/gh',
        meta: 'quick link',
        detail: '96 clicks',
      },
      {
        id: 'l-3',
        title: '/readme',
        meta: 'quick link',
        detail: '41 clicks',
      },
    ],
    terminal: [
      '$ bri link create yt https://youtube.com/@egeuysall',
      'created /yt',
      '$ bri link stats yt',
      '/yt: 184 clicks',
    ],
  },
  {
    id: 'settings',
    title: 'settings',
    path: '/dashboard?tab=settings',
    stat: '3 api keys',
    caption: 'Issue scoped API keys for CLI clients.',
    rows: [
      {
        id: 's-1',
        title: 'cli',
        meta: 'read_write',
        detail: 'last used 2h ago',
      },
      {
        id: 's-2',
        title: 'deploy',
        meta: 'write',
        detail: 'last used 1d ago',
      },
      {
        id: 's-3',
        title: 'reader',
        meta: 'read',
        detail: 'last used 5d ago',
      },
    ],
    terminal: [
      '$ bri key create --label cli --permissions read_write',
      'api key created',
      '$ bri key list',
      '3 active keys',
    ],
  },
];

function nextPanelIndex(currentIndex: number): number {
  return (currentIndex + 1) % demoPanels.length;
}

export function CliMotionPreview() {
  const [activePanelIndex, setActivePanelIndex] = useState(0);
  const [activeRowIndex, setActiveRowIndex] = useState(0);
  const [isPaused, setIsPaused] = useState(false);

  const activePanel = demoPanels[activePanelIndex] ?? demoPanels[0]!;
  const visibleRows = activePanel.rows.slice(0, 2);

  useEffect(() => {
    if (isPaused) return;

    const panelTimer = window.setInterval(() => {
      setActivePanelIndex((current) => nextPanelIndex(current));
      setActiveRowIndex(0);
    }, PANEL_INTERVAL_MS);

    return () => {
      window.clearInterval(panelTimer);
    };
  }, [isPaused]);

  useEffect(() => {
    if (isPaused) return;

    const rowTimer = window.setInterval(() => {
      setActiveRowIndex((current) => (current + 1) % visibleRows.length);
    }, ROW_INTERVAL_MS);

    return () => {
      window.clearInterval(rowTimer);
    };
  }, [isPaused, visibleRows.length]);

  return (
    <section
      className="w-full rounded-sm border border-neutral-800 bg-[var(--bg)] p-3 sm:p-4"
      onMouseEnter={() => setIsPaused(true)}
      onMouseLeave={() => setIsPaused(false)}
      onFocusCapture={() => setIsPaused(true)}
      onBlurCapture={() => setIsPaused(false)}
    >
      <div className="mb-4 flex items-center justify-between gap-4">
        <p className="text-sm text-neutral-300">Demo</p>
        <p className="text-xs text-neutral-500">{activePanel.stat}</p>
      </div>

      <div className="space-y-4">
        <nav className="grid grid-cols-3 gap-2" aria-label="Dashboard demo panels">
          {demoPanels.map((panel, index) => (
            <button
              key={panel.id}
              type="button"
              aria-pressed={activePanelIndex === index}
              onClick={() => {
                setActivePanelIndex(index);
                setActiveRowIndex(0);
              }}
              className={cn(
                'rounded-sm border px-3 py-2.5 text-left transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[var(--fg)]',
                activePanelIndex === index
                  ? 'border-neutral-600 bg-neutral-900 text-neutral-100'
                  : 'border-neutral-900 text-neutral-500 hover:border-neutral-700 hover:text-neutral-300'
              )}
            >
              <p className="text-sm leading-none">{panel.title}</p>
              <p className="mt-1 text-[11px] text-neutral-500">{panel.stat}</p>
            </button>
          ))}
        </nav>

        <p className="mt-2 rounded-sm border border-neutral-900 bg-neutral-950 px-3 py-2 font-mono text-xs text-neutral-300">
          {activePanel.path}
        </p>

        <p className="mt-2 text-xs text-neutral-500">{activePanel.caption}</p>

        <div className="mt-2 grid gap-2">
          {visibleRows.map((row, index) => {
            const isActive = activeRowIndex === index;

            return (
              <button
                key={row.id}
                type="button"
                aria-pressed={isActive}
                onClick={() => setActiveRowIndex(index)}
                className={cn(
                  'flex w-full items-start justify-between gap-3 rounded-sm border px-3 py-1.5 text-left transition-all focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[var(--fg)]',
                  isActive
                    ? 'border-neutral-600 bg-neutral-900 text-neutral-100'
                    : 'border-neutral-900 text-neutral-400 hover:border-neutral-700 hover:text-neutral-200'
                )}
              >
                <span>
                  <span className="block text-sm">{row.title}</span>
                  <span className="mt-0.5 block text-[11px] text-neutral-500">{row.meta}</span>
                </span>
                <span
                  className={cn('text-[11px]', isActive ? 'text-neutral-400' : 'text-neutral-500')}
                >
                  {row.detail}
                </span>
              </button>
            );
          })}
        </div>

        <div
          className="mt-3 rounded-sm border border-neutral-900 bg-neutral-950 p-2.5 font-mono text-[11px] leading-5 text-neutral-200"
          aria-label="CLI output preview"
        >
          <p className="text-neutral-400">$ bri cli monitor --live</p>
          <div className="mt-1.5 space-y-0.5">
            {activePanel.terminal.slice(0, 2).map((line) => (
              <p key={line}>{line}</p>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
