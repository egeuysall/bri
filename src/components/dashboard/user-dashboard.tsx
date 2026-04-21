'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { Bar, BarChart, CartesianGrid, XAxis } from 'recharts';
import { toast } from 'sonner';
import { AppSidebar, type DashboardPanel } from '@/components/app-sidebar';
import { CodeBlock } from '@/components/markdown/code-block';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from '@/components/ui/chart';
import {
  Combobox,
  ComboboxContent,
  ComboboxEmpty,
  ComboboxGroup,
  ComboboxInput,
  ComboboxItem,
  ComboboxList,
} from '@/components/ui/combobox';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationNext,
  PaginationPrevious,
} from '@/components/ui/pagination';
import { Skeleton } from '@/components/ui/skeleton';
import { SidebarInset, SidebarProvider, useSidebar } from '@/components/ui/sidebar';

type NoteRecord = {
  id: string;
  username: string;
  slug: string;
  title: string;
  content: string;
  visibility: 'public' | 'private';
  createdAt: number;
  updatedAt: number;
  expiresAt: number | null;
  deletedAt: number | null;
  purgeAt: number | null;
};

type ApiKeyRecord = {
  id: string;
  prefix: string;
  permissions: 'read' | 'write' | 'read_write';
  label: string | null;
  createdAt: number;
  lastUsedAt: number | null;
  revokedAt: number | null;
};

type QuickLinkRecord = {
  id: string;
  username: string;
  key: string;
  targetUrl: string;
  label: string | null;
  clicks: number;
  createdAt: number;
  updatedAt: number;
  lastClickedAt: number | null;
};

type PinnedRecord = {
  id: string;
  kind: 'note' | 'link';
  noteId: string | null;
  linkId: string | null;
  title: string;
  href: string;
  createdAt: number;
};

type AnalyticsRecord = {
  totalViews: number;
  totalPageViews?: number;
  totalLinkClicks?: number;
  days: number;
  viewsBySlug: Record<string, number>;
  topPages: Array<{ slug: string; views: number }>;
  daily: Array<{ date: string; views: number; pageViews?: number; linkClicks?: number }>;
};

type NotificationRecord = {
  id: string;
  kind: 'invitation' | 'achievement' | 'notice';
  title: string;
  message: string;
  noteId: string | null;
  linkId: string | null;
  createdAt: number;
};

function formatDate(value: number | null): string {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  }).format(date);
}

function formatExpiresIn(value: number | null): string {
  if (!value) return 'no expiry';

  const diffMs = value - Date.now();
  if (diffMs <= 0) return 'expired';

  const diffHours = Math.round(diffMs / (1000 * 60 * 60));
  if (diffHours < 24) return `in ${diffHours}h`;

  const diffDays = Math.round(diffMs / (1000 * 60 * 60 * 24));
  return `in ${diffDays}d`;
}

function comboboxInputClass(widthClass = 'w-56') {
  return `${widthClass} h-8 border-neutral-800 bg-transparent text-xs`;
}

const chartConfig = {
  pageViews: {
    label: 'Pages',
    color: 'var(--fg)',
  },
  linkClicks: {
    label: 'Links',
    color: 'var(--fg)',
  },
} satisfies ChartConfig;

function formatChartDate(value: string) {
  const date = new Date(`${value}T00:00:00.000Z`);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
  });
}

function expirationValueFromExpiresAt<T extends string>(
  expiresAt: number | null,
  options: ReadonlyArray<{ value: T; days: number }>
): T {
  const fallback = options[options.length - 1]?.value ?? options[0]?.value;
  if (!fallback) {
    throw new Error('Missing expiration options');
  }
  if (!expiresAt) return fallback;
  const remainingDays = (expiresAt - Date.now()) / (24 * 60 * 60 * 1000);
  if (!Number.isFinite(remainingDays) || remainingDays <= 0) return fallback;

  let selected = options[options.length - 1] ?? options[0];
  let smallestDiff = Number.POSITIVE_INFINITY;
  for (const option of options) {
    const diff = Math.abs(option.days - remainingDays);
    if (diff < smallestDiff) {
      smallestDiff = diff;
      selected = option;
    }
  }
  return selected?.value ?? fallback;
}

function MobileSidebarTrigger() {
  const { toggleSidebar } = useSidebar();

  return (
    <Button
      type="button"
      variant="ghost"
      onClick={toggleSidebar}
      className="h-8 w-8 justify-start px-1 text-xs tracking-wide"
    >
      ///
    </Button>
  );
}

export function UserDashboard() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const tabFromQuery = searchParams.get('tab');
  const initialPanel: DashboardPanel =
    tabFromQuery === 'notes' ||
    tabFromQuery === 'new' ||
    tabFromQuery === 'links' ||
    tabFromQuery === 'profile' ||
    tabFromQuery === 'settings' ||
    tabFromQuery === 'deleted'
      ? tabFromQuery
      : 'notes';

  const PAGE_SIZE = 12;
  const visibilityOptions = [
    { value: 'public', label: 'public' },
    { value: 'private', label: 'private' },
  ] as const;
  const expirationOptions = [
    { value: '1h', label: '1 hour', days: 1 / 24 },
    { value: '6h', label: '6 hours', days: 6 / 24 },
    { value: '1d', label: '1 day', days: 1 },
    { value: '7d', label: '7 days', days: 7 },
    { value: '30d', label: '30 days', days: 30 },
  ] as const;
  const permissionOptions = [
    { value: 'read', label: 'read' },
    { value: 'write', label: 'write' },
    { value: 'read_write', label: 'read + write' },
  ] as const;

  const [panel, setPanel] = useState<DashboardPanel>(initialPanel);
  const [notes, setNotes] = useState<NoteRecord[]>([]);
  const [deletedNotes, setDeletedNotes] = useState<NoteRecord[]>([]);
  const [notesPage, setNotesPage] = useState<number>(1);
  const [linksPage, setLinksPage] = useState<number>(1);
  const [deletedPage, setDeletedPage] = useState<number>(1);
  const [apiKeys, setApiKeys] = useState<ApiKeyRecord[]>([]);
  const [quickLinks, setQuickLinks] = useState<QuickLinkRecord[]>([]);
  const [pins, setPins] = useState<PinnedRecord[]>([]);
  const [analytics, setAnalytics] = useState<AnalyticsRecord | null>(null);
  const [notifications, setNotifications] = useState<NotificationRecord[]>([]);
  const [generatedApiKey, setGeneratedApiKey] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(false);
  const [isInitializing, setIsInitializing] = useState<boolean>(true);

  const [noteTitle, setNoteTitle] = useState<string>('');
  const [content, setContent] = useState<string>('');
  const [visibility, setVisibility] = useState<'public' | 'private'>('public');
  const [expirationValue, setExpirationValue] =
    useState<(typeof expirationOptions)[number]['value']>('30d');

  const [keyLabel, setKeyLabel] = useState<string>('cli');
  const [keyPermissions, setKeyPermissions] = useState<'read' | 'write' | 'read_write'>('read');

  const [quickLinkKey, setQuickLinkKey] = useState<string>('');
  const [quickLinkUrl, setQuickLinkUrl] = useState<string>('');
  const [quickLinkLabel, setQuickLinkLabel] = useState<string>('');
  const [editingNoteId, setEditingNoteId] = useState<string | null>(null);
  const [editingNoteTitle, setEditingNoteTitle] = useState<string>('');
  const [editingNoteContent, setEditingNoteContent] = useState<string>('');
  const [editingNoteVisibility, setEditingNoteVisibility] = useState<'public' | 'private'>('public');
  const [editingNoteExpirationValue, setEditingNoteExpirationValue] =
    useState<(typeof expirationOptions)[number]['value']>('30d');
  const [editingLinkId, setEditingLinkId] = useState<string | null>(null);
  const [editingLinkKey, setEditingLinkKey] = useState<string>('');
  const [editingLinkUrl, setEditingLinkUrl] = useState<string>('');
  const [editingLinkLabel, setEditingLinkLabel] = useState<string>('');
  const [inviteDialogOpen, setInviteDialogOpen] = useState<boolean>(false);
  const [inviteTargetKind, setInviteTargetKind] = useState<'note' | 'link' | null>(null);
  const [inviteTargetId, setInviteTargetId] = useState<string | null>(null);
  const [inviteeUsername, setInviteeUsername] = useState<string>('');
  const [isSubmittingInvite, setIsSubmittingInvite] = useState<boolean>(false);
  const [notificationsPanelOpen, setNotificationsPanelOpen] = useState<boolean>(false);
  const [dismissedAchievementIds, setDismissedAchievementIds] = useState<string[]>([]);
  const [dismissedNoticeIds, setDismissedNoticeIds] = useState<string[]>([]);

  const editorRef = useRef<HTMLTextAreaElement>(null);

  const cliInstallCommand = useMemo(() => {
    if (typeof window !== 'undefined') {
      return `curl -fsSL ${window.location.origin}/install.sh | bash`;
    }
    return 'curl -fsSL https://bri.egeuysal.com/install.sh | bash';
  }, []);
  const profileHandle = useMemo(() => {
    const segments = pathname.split('/').filter(Boolean);
    return segments[0] ?? '';
  }, [pathname]);
  const publicProfileUrl = useMemo(() => {
    if (!profileHandle) return '';
    if (typeof window !== 'undefined') {
      return `${window.location.origin}/${profileHandle}?public=1`;
    }
    return `/${profileHandle}?public=1`;
  }, [profileHandle]);

  const notePages = Math.max(1, Math.ceil(notes.length / PAGE_SIZE));
  const linksPages = Math.max(1, Math.ceil(quickLinks.length / PAGE_SIZE));
  const deletedPages = Math.max(1, Math.ceil(deletedNotes.length / PAGE_SIZE));
  const visibleNotes = useMemo(
    () => notes.slice((notesPage - 1) * PAGE_SIZE, notesPage * PAGE_SIZE),
    [notes, notesPage]
  );
  const visibleDeletedNotes = useMemo(
    () => deletedNotes.slice((deletedPage - 1) * PAGE_SIZE, deletedPage * PAGE_SIZE),
    [deletedNotes, deletedPage]
  );
  const visibleQuickLinks = useMemo(
    () => quickLinks.slice((linksPage - 1) * PAGE_SIZE, linksPage * PAGE_SIZE),
    [quickLinks, linksPage]
  );
  const viewsBySlug = useMemo<Record<string, number>>(() => {
    if (!analytics) return {};
    if (analytics.viewsBySlug) return analytics.viewsBySlug;
    return analytics.topPages.reduce<Record<string, number>>((accumulator, row) => {
      accumulator[row.slug] = row.views;
      return accumulator;
    }, {});
  }, [analytics]);
  const pinnedNoteIds = useMemo(
    () =>
      new Set(
        pins
          .filter((pin) => pin.kind === 'note' && typeof pin.noteId === 'string')
          .map((pin) => pin.noteId as string)
      ),
    [pins]
  );
  const pinnedLinkIds = useMemo(
    () =>
      new Set(
        pins
          .filter((pin) => pin.kind === 'link' && typeof pin.linkId === 'string')
          .map((pin) => pin.linkId as string)
      ),
    [pins]
  );
  const noteViewsById = useMemo(() => {
    const allNotes = [...notes, ...deletedNotes];
    return allNotes.reduce<Record<string, number>>((accumulator, note) => {
      accumulator[note.id] = viewsBySlug[note.slug] ?? 0;
      return accumulator;
    }, {});
  }, [deletedNotes, notes, viewsBySlug]);
  const linkClicksById = useMemo(
    () =>
      quickLinks.reduce<Record<string, number>>((accumulator, link) => {
        accumulator[link.id] = link.clicks;
        return accumulator;
      }, {}),
    [quickLinks]
  );
  const pinnedSidebarItems = useMemo(
    () =>
      pins.map((pin) => ({
        id: pin.id,
        title: pin.title,
        href: pin.href,
        count:
          pin.kind === 'note'
            ? pin.noteId
              ? noteViewsById[pin.noteId] ?? 0
              : 0
            : pin.linkId
              ? linkClicksById[pin.linkId] ?? 0
              : 0,
      })),
    [linkClicksById, noteViewsById, pins]
  );
  const chartData = useMemo(() => {
    const source = analytics?.daily ?? [];
    return source.slice(-14).map((row) => ({
      date: row.date,
      pageViews: row.pageViews ?? row.views ?? 0,
      linkClicks: row.linkClicks ?? 0,
    }));
  }, [analytics]);
  const invitationNotifications = useMemo(
    () => notifications.filter((row) => row.kind === 'invitation').slice(0, 12),
    [notifications]
  );
  const achievementItems = useMemo(() => {
    const items: Array<{ id: string; message: string }> = [];
    const seen = new Set<string>();
    const add = (id: string, message: string) => {
      if (!message || seen.has(id)) return;
      seen.add(id);
      items.push({ id, message });
    };

    for (const row of notifications) {
      if (row.kind === 'achievement') add(row.id, row.message || row.title);
    }

    const totalViews = analytics?.totalViews ?? 0;
    const topDailyViews = (analytics?.daily ?? []).reduce(
      (max, row) => Math.max(max, row.views ?? 0),
      0
    );

    if (notes.length >= 1) add('local:achievement:first-note', 'first note published');
    if (quickLinks.length >= 1) add('local:achievement:first-link', 'first quick link created');
    if (notes.length >= 10) add('local:achievement:ten-notes', '10 notes published');
    if (topDailyViews >= 500) add('local:achievement:500-daily', '500 views in 1 day');
    if (totalViews >= 500) add('local:achievement:500-total', '500 views milestone');
    if (totalViews >= 1000) add('local:achievement:1000-total', '1k views milestone');

    return items.filter((row) => !dismissedAchievementIds.includes(row.id));
  }, [analytics?.daily, analytics?.totalViews, dismissedAchievementIds, notes.length, notifications, quickLinks.length]);
  const noticeItems = useMemo(() => {
    const items: Array<{ id: string; message: string }> = [];
    const seen = new Set<string>();
    const add = (id: string, message: string) => {
      if (!message || seen.has(id)) return;
      seen.add(id);
      items.push({ id, message });
    };

    for (const row of notifications) {
      if (row.kind === 'notice') add(row.id, row.message || row.title);
    }

    const now = Date.now();
    const soonThreshold = now + 3 * 24 * 60 * 60 * 1000;
    for (const note of notes) {
      if (note.expiresAt !== null && note.expiresAt <= soonThreshold) {
        add(
          `local:notice:expiry:${note.id}`,
          `note "${note.title}" expires ${formatExpiresIn(note.expiresAt)}`
        );
      }
    }

    return items.filter((row) => !dismissedNoticeIds.includes(row.id));
  }, [dismissedNoticeIds, notes, notifications]);

  async function fetchNotes(state: 'active' | 'deleted') {
    const response = await fetch(`/api/notes?state=${state}`);
    if (!response.ok) {
      throw new Error('Failed to fetch notes');
    }

    const json = (await response.json()) as { data?: NoteRecord[] };
    return json.data ?? [];
  }

  async function refreshData() {
    setLoading(true);
    try {
      const [active, deleted] = await Promise.all([fetchNotes('active'), fetchNotes('deleted')]);
      setNotes(active);
      setDeletedNotes(deleted);
      setNotesPage(1);
      setDeletedPage(1);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to load dashboard data');
    } finally {
      setLoading(false);
    }
  }

  async function refreshApiKeys(options?: { clearGenerated?: boolean }) {
    if (options?.clearGenerated !== false) {
      setGeneratedApiKey('');
    }

    const response = await fetch('/api/keys');
    if (!response.ok) throw new Error('Failed to fetch api keys');
    const json = (await response.json()) as { data?: ApiKeyRecord[] };
    setApiKeys((json.data ?? []).filter((item) => item.revokedAt === null));
  }

  async function refreshQuickLinks() {
    const response = await fetch('/api/quick-links');
    if (!response.ok) throw new Error('Failed to fetch quick links');
    const json = (await response.json()) as { data?: QuickLinkRecord[] };
    setQuickLinks(json.data ?? []);
    setLinksPage(1);
  }

  async function refreshPins() {
    const response = await fetch('/api/pins');
    if (!response.ok) throw new Error('Failed to fetch pins');
    const json = (await response.json()) as { data?: PinnedRecord[] };
    setPins(json.data ?? []);
  }

  async function refreshAnalytics() {
    const response = await fetch('/api/analytics?days=30');
    if (response.status === 403) {
      setAnalytics(null);
      return;
    }
    if (!response.ok) throw new Error('Failed to fetch analytics');
    const json = (await response.json()) as { data?: AnalyticsRecord };
    setAnalytics(json.data ?? null);
  }

  async function refreshNotifications() {
    const response = await fetch('/api/notifications');
    if (response.status === 401) {
      setNotifications([]);
      return;
    }
    if (!response.ok) throw new Error('Failed to fetch notifications');
    const json = (await response.json()) as { data?: { items?: NotificationRecord[] } };
    setNotifications(json.data?.items ?? []);
  }

  async function syncProfile() {
    await fetch('/api/profile/sync', { method: 'POST' });
  }

  useEffect(() => {
    const currentTab = searchParams.get('tab');
    if (currentTab === panel) return;
    const params = new URLSearchParams(searchParams.toString());
    params.set('tab', panel);
    router.replace(`${pathname}?${params.toString()}`, { scroll: false });
  }, [panel, pathname, router, searchParams]);

  useEffect(() => {
    let isMounted = true;

    async function bootstrap() {
      try {
        await Promise.all([
          syncProfile().catch(() => undefined),
          refreshData(),
          refreshQuickLinks(),
          refreshPins(),
          refreshAnalytics().catch(() => undefined),
          refreshNotifications().catch(() => undefined),
        ]);
      } catch (error) {
        toast.error(error instanceof Error ? error.message : 'Failed to initialize dashboard');
      } finally {
        if (isMounted) setIsInitializing(false);
      }
    }

    void bootstrap();
    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    if (panel === 'settings') {
      void Promise.all([
        refreshApiKeys(),
        refreshQuickLinks(),
        refreshAnalytics(),
        refreshNotifications(),
      ]).catch(() => {
        toast.error('Failed to load settings data');
      });
      return;
    }

    if (panel === 'notes') {
      void refreshAnalytics().catch(() => {
        toast.error('Failed to load note views');
      });
      return;
    }

    if (panel === 'links') {
      void Promise.all([refreshQuickLinks(), refreshPins()]).catch(() => {
        toast.error('Failed to load links');
      });
    }
  }, [panel]);

  function wrapSelection(prefix: string, suffix = prefix) {
    const textarea = editorRef.current;
    if (!textarea) return;

    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const selected = textarea.value.slice(start, end);
    const next = `${textarea.value.slice(0, start)}${prefix}${selected}${suffix}${textarea.value.slice(end)}`;

    setContent(next);
    queueMicrotask(() => {
      textarea.focus();
      const cursorStart = start + prefix.length;
      const cursorEnd = cursorStart + selected.length;
      textarea.setSelectionRange(cursorStart, cursorEnd);
    });
  }

  function insertHeading() {
    const textarea = editorRef.current;
    if (!textarea) return;

    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const selected = textarea.value.slice(start, end);
    const next = `${textarea.value.slice(0, start)}# ${selected}${textarea.value.slice(end)}`;

    setContent(next);
    queueMicrotask(() => {
      textarea.focus();
      const cursorStart = start + 2;
      const cursorEnd = cursorStart + selected.length;
      textarea.setSelectionRange(cursorStart, cursorEnd);
    });
  }

  async function createNote() {
    const title = noteTitle.trim();
    if (!title) {
      toast.error('Title is required');
      return;
    }

    const response = await fetch('/api/notes', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title,
        content,
        visibility,
        expiresInDays:
          expirationOptions.find((option) => option.value === expirationValue)?.days ?? 30,
      }),
    });

    const json = (await response.json()) as {
      error?: string;
      data?: { username: string; slug: string };
    };

    if (!response.ok) {
      throw new Error(json.error || 'Failed to create note');
    }

    setPanel('notes');
    setNoteTitle('');
    setContent('');
    setExpirationValue('30d');
    await refreshData();
    await refreshPins();
    toast.success('Note published');
  }

  function startEditNote(note: NoteRecord) {
    setEditingNoteId(note.id);
    setEditingNoteTitle(note.title);
    setEditingNoteContent(note.content ?? '');
    setEditingNoteVisibility(note.visibility);
    setEditingNoteExpirationValue(
      expirationValueFromExpiresAt(note.expiresAt, expirationOptions)
    );
  }

  function cancelEditNote() {
    setEditingNoteId(null);
    setEditingNoteTitle('');
    setEditingNoteContent('');
    setEditingNoteVisibility('public');
    setEditingNoteExpirationValue('30d');
  }

  async function saveNoteEdits(noteId: string) {
    const title = editingNoteTitle.trim();
    const nextContent = editingNoteContent.trim();

    if (!title) {
      toast.error('Title is required');
      return;
    }
    if (!nextContent) {
      toast.error('Content cannot be empty');
      return;
    }

    const response = await fetch(`/api/notes/by-id/${noteId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'update',
        title,
        content: editingNoteContent,
        visibility: editingNoteVisibility,
        expiresInDays:
          expirationOptions.find((option) => option.value === editingNoteExpirationValue)?.days ??
          30,
      }),
    });

    const json = (await response.json()) as { error?: string };
    if (!response.ok) {
      throw new Error(json.error || 'Failed to update note');
    }

    cancelEditNote();
    await refreshData();
    await refreshPins();
    await refreshAnalytics().catch(() => undefined);
    toast.success('Note updated');
  }

  async function patchNote(noteId: string, action: 'softDelete' | 'restore' | 'permanentDelete') {
    const response = await fetch(`/api/notes/by-id/${noteId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action }),
    });

    const json = (await response.json()) as { error?: string };
    if (!response.ok) {
      throw new Error(json.error || 'Failed to update note');
    }

    await refreshData();
    await refreshPins();
  }

  async function generateApiKey() {
    setGeneratedApiKey('');

    const response = await fetch('/api/keys', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        permissions: keyPermissions,
        label: keyLabel.trim() || 'cli',
      }),
    });

    const json = (await response.json()) as { error?: string; data?: { key?: string } };
    if (!response.ok) {
      throw new Error(json.error || 'Failed to generate api key');
    }

    setGeneratedApiKey(json.data?.key || '');
    setKeyLabel('cli');
    await refreshApiKeys({ clearGenerated: false });
    toast.success('API key generated');
  }

  async function revokeKey(keyId: string) {
    const response = await fetch(`/api/keys/${keyId}`, { method: 'DELETE' });
    const json = (await response.json()) as { error?: string };
    if (!response.ok) throw new Error(json.error || 'Failed to revoke key');
    await refreshApiKeys();
    toast.success('API key revoked');
  }

  async function createQuickLinkHandler() {
    const key = quickLinkKey.trim();
    const targetUrl = quickLinkUrl.trim();
    if (!key) {
      toast.error('Quick link key is required');
      return;
    }
    if (!targetUrl) {
      toast.error('Target URL is required');
      return;
    }

    const response = await fetch('/api/quick-links', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        key,
        targetUrl,
        label: quickLinkLabel.trim() || null,
      }),
    });

    const json = (await response.json()) as { error?: string };
    if (!response.ok) {
      throw new Error(json.error || 'Failed to create quick link');
    }

    setQuickLinkKey('');
    setQuickLinkUrl('');
    setQuickLinkLabel('');
    await refreshQuickLinks();
    await refreshPins();
    toast.success('Quick link created');
  }

  function startEditQuickLink(link: QuickLinkRecord) {
    setEditingLinkId(link.id);
    setEditingLinkKey(link.key);
    setEditingLinkUrl(link.targetUrl);
    setEditingLinkLabel(link.label ?? '');
  }

  function cancelEditQuickLink() {
    setEditingLinkId(null);
    setEditingLinkKey('');
    setEditingLinkUrl('');
    setEditingLinkLabel('');
  }

  async function saveQuickLinkEdits(linkId: string) {
    const key = editingLinkKey.trim();
    const targetUrl = editingLinkUrl.trim();
    const label = editingLinkLabel.trim() || null;

    if (!key) {
      toast.error('Quick link key is required');
      return;
    }
    if (!targetUrl) {
      toast.error('Target URL is required');
      return;
    }

    const response = await fetch(`/api/quick-links/${linkId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        key,
        targetUrl,
        label,
      }),
    });

    const json = (await response.json()) as { error?: string };
    if (!response.ok) {
      throw new Error(json.error || 'Failed to update quick link');
    }

    cancelEditQuickLink();
    await refreshQuickLinks();
    await refreshPins();
    await refreshAnalytics().catch(() => undefined);
    toast.success('Quick link updated');
  }

  async function removeQuickLinkHandler(linkId: string) {
    const response = await fetch(`/api/quick-links/${linkId}`, { method: 'DELETE' });
    const json = (await response.json()) as { error?: string };
    if (!response.ok) {
      throw new Error(json.error || 'Failed to remove quick link');
    }
    await refreshQuickLinks();
    await refreshPins();
    toast.success('Quick link removed');
  }

  async function togglePin(kind: 'note' | 'link', id: string) {
    const response = await fetch('/api/pins', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type: kind, id }),
    });
    const json = (await response.json()) as { error?: string; data?: { pinned?: boolean } };
    if (!response.ok) {
      throw new Error(json.error || 'Failed to update pin');
    }
    await refreshPins();
    toast.success(json.data?.pinned ? 'Pinned' : 'Unpinned');
  }

  function openInviteDialog(kind: 'note' | 'link', id: string) {
    setInviteTargetKind(kind);
    setInviteTargetId(id);
    setInviteeUsername('');
    setInviteDialogOpen(true);
  }

  async function submitInvite() {
    if (!inviteTargetKind || !inviteTargetId) return;
    const normalizedInvitee = inviteeUsername.trim().toLowerCase().replace(/[^a-z0-9_-]/g, '');
    if (!normalizedInvitee) {
      toast.error('Invitee username is required');
      return;
    }
    setIsSubmittingInvite(true);
    const response = await fetch('/api/invitations', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        kind: inviteTargetKind,
        id: inviteTargetId,
        inviteeUsername: normalizedInvitee,
      }),
    });
    const json = (await response.json()) as { error?: string };
    setIsSubmittingInvite(false);
    if (!response.ok) {
      throw new Error(json.error || 'Failed to invite user');
    }

    setInviteDialogOpen(false);
    setInviteTargetKind(null);
    setInviteTargetId(null);
    setInviteeUsername('');
    toast.success(`Invited @${normalizedInvitee}`);
  }

  async function dismissNotification(notificationId: string) {
    const response = await fetch('/api/notifications', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'dismiss', notificationId }),
    });
    const json = (await response.json()) as { error?: string };
    if (!response.ok) {
      throw new Error(json.error || 'Failed to dismiss notification');
    }

    setNotifications((prev) => prev.filter((row) => row.id !== notificationId));
  }

  async function openNotification(notificationId: string) {
    const response = await fetch('/api/notifications', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'open', notificationId }),
    });
    const json = (await response.json()) as { error?: string; data?: { href?: string | null } };
    if (!response.ok) {
      throw new Error(json.error || 'Failed to open notification');
    }

    const href = json.data?.href ?? null;
    if (!href) {
      toast.error('Shared item is unavailable');
      return;
    }

    setNotificationsPanelOpen(false);
    router.push(href);
  }

  function dismissAchievement(id: string) {
    setDismissedAchievementIds((prev) => (prev.includes(id) ? prev : [...prev, id]));
  }

  function dismissNotice(id: string) {
    setDismissedNoticeIds((prev) => (prev.includes(id) ? prev : [...prev, id]));
  }

  return (
    <SidebarProvider defaultOpen>
      <AppSidebar panel={panel} pinnedItems={pinnedSidebarItems} onPanelChange={setPanel} />
      <SidebarInset className="min-h-screen bg-bg">
        <header className="flex h-14 items-center gap-2 border-b border-neutral-900 px-4 md:hidden">
          <MobileSidebarTrigger />
        </header>
        <section className="w-full px-4 py-5 md:px-8">
          <div className="mx-auto w-full max-w-none space-y-5">
            {isInitializing ? (
              <div className="space-y-3">
                <Skeleton className="h-4 w-24 rounded-sm bg-neutral-900" />
                <div className="space-y-2 rounded-sm bg-neutral-900/60 px-4 py-3">
                  <Skeleton className="h-4 w-40 rounded-sm bg-neutral-900" />
                  <Skeleton className="h-3 w-72 rounded-sm bg-neutral-900" />
                </div>
                <div className="space-y-2 rounded-sm bg-neutral-900/60 px-4 py-3">
                  <Skeleton className="h-4 w-32 rounded-sm bg-neutral-900" />
                  <Skeleton className="h-3 w-64 rounded-sm bg-neutral-900" />
                </div>
                <div className="space-y-2 rounded-sm bg-neutral-900/60 px-4 py-3">
                  <Skeleton className="h-4 w-36 rounded-sm bg-neutral-900" />
                  <Skeleton className="h-3 w-80 rounded-sm bg-neutral-900" />
                </div>
              </div>
            ) : null}
            {!isInitializing && loading ? <p className="text-xs text-neutral-500">Refreshing…</p> : null}

            {!isInitializing && panel === 'notes' ? (
              <div className="w-full space-y-3">
                <h1 className="text-sm text-neutral-200">Your notes</h1>
                {notes.length === 0 ? <p className="text-xs text-neutral-500">No notes yet.</p> : null}
                {visibleNotes.map((note) => {
                  const isEditing = editingNoteId === note.id;
                  if (isEditing) {
                    return (
                      <article
                        key={note.id}
                        className="space-y-3 rounded-sm border border-neutral-900 p-3"
                      >
                        <div className="grid gap-2 md:grid-cols-2">
                          <input
                            value={editingNoteTitle}
                            onChange={(event) => setEditingNoteTitle(event.target.value)}
                            placeholder="Title"
                            className="h-8 rounded-sm border border-neutral-800 bg-transparent px-2 text-xs text-neutral-100"
                          />
                          <Combobox
                            items={[...visibilityOptions]}
                            value={editingNoteVisibility}
                            onValueChange={(next) =>
                              setEditingNoteVisibility(next === 'private' ? 'private' : 'public')
                            }
                          >
                            <ComboboxInput
                              placeholder="Visibility"
                              className={comboboxInputClass('w-full')}
                            />
                            <ComboboxContent>
                              <ComboboxEmpty>No visibility found.</ComboboxEmpty>
                              <ComboboxList>
                                <ComboboxGroup>
                                  {visibilityOptions.map((option) => (
                                    <ComboboxItem key={option.value} value={option.value}>
                                      {option.label}
                                    </ComboboxItem>
                                  ))}
                                </ComboboxGroup>
                              </ComboboxList>
                            </ComboboxContent>
                          </Combobox>
                        </div>

                        <textarea
                          value={editingNoteContent}
                          onChange={(event) => setEditingNoteContent(event.target.value)}
                          className="min-h-[14rem] w-full rounded-sm border border-neutral-800 bg-transparent p-2 text-xs text-neutral-200"
                        />

                        <div className="flex flex-wrap items-center gap-2">
                          <Combobox
                            items={[...expirationOptions]}
                            value={editingNoteExpirationValue}
                            onValueChange={(value) => {
                              const next = expirationOptions.find((option) => option.value === value);
                              if (next) setEditingNoteExpirationValue(next.value);
                            }}
                          >
                            <ComboboxInput
                              placeholder="Expiration"
                              className={comboboxInputClass('w-44')}
                            />
                            <ComboboxContent>
                              <ComboboxEmpty>No duration found.</ComboboxEmpty>
                              <ComboboxList>
                                <ComboboxGroup>
                                  {expirationOptions.map((option) => (
                                    <ComboboxItem key={option.value} value={option.value}>
                                      {option.label}
                                    </ComboboxItem>
                                  ))}
                                </ComboboxGroup>
                              </ComboboxList>
                            </ComboboxContent>
                          </Combobox>
                          <Button
                            type="button"
                            variant="default"
                            className="h-8 text-xs"
                            onClick={() => {
                              void saveNoteEdits(note.id).catch((err) =>
                                toast.error(err instanceof Error ? err.message : 'Failed to update note')
                              );
                            }}
                          >
                            Save
                          </Button>
                          <Button
                            type="button"
                            variant="ghost"
                            className="h-8 border border-neutral-800 text-xs"
                            onClick={cancelEditNote}
                          >
                            Cancel
                          </Button>
                        </div>
                      </article>
                    );
                  }

                  return (
                    <article
                      key={note.id}
                      className="group cursor-pointer rounded-sm border border-neutral-900 px-3 py-3 transition-colors hover:bg-neutral-900/40"
                      role="link"
                      tabIndex={0}
                      onClick={() => {
                        router.push(`/${note.username}/${note.slug}`);
                      }}
                      onKeyDown={(event) => {
                        if (event.key === 'Enter' || event.key === ' ') {
                          event.preventDefault();
                          router.push(`/${note.username}/${note.slug}`);
                        }
                      }}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="text-sm text-neutral-100">{note.title}</p>
                          <p className="mt-1 text-[11px] text-neutral-500">
                            /{note.username}/{note.slug} &middot; {note.visibility} &middot; created{' '}
                            {formatDate(note.createdAt)} &middot; expires {formatExpiresIn(note.expiresAt)}{' '}
                            &middot; views {viewsBySlug[note.slug] ?? 0}
                          </p>
                        </div>
                        <div className="flex items-center gap-2">
                          <Button
                            type="button"
                            variant="default"
                            className="h-8 text-xs"
                            onClick={(event) => {
                              event.stopPropagation();
                              startEditNote(note);
                            }}
                          >
                            Edit
                          </Button>
                          <Button
                            type="button"
                            variant="default"
                            className="h-8 text-xs"
                            onClick={(event) => {
                              event.stopPropagation();
                              openInviteDialog('note', note.id);
                            }}
                          >
                            Share
                          </Button>
                          <Button
                            type="button"
                            variant="default"
                            className="h-8 text-xs"
                            onClick={(event) => {
                              event.stopPropagation();
                              void togglePin('note', note.id).catch((err) =>
                                toast.error(
                                  err instanceof Error ? err.message : 'Failed to toggle pin'
                                )
                              );
                            }}
                          >
                            {pinnedNoteIds.has(note.id) ? '<' : '>'}
                          </Button>
                          <Button
                            type="button"
                            variant="default"
                            className="h-8 text-xs"
                            onClick={(event) => {
                              event.stopPropagation();
                              void patchNote(note.id, 'softDelete').catch((err) =>
                                toast.error(
                                  err instanceof Error ? err.message : 'Failed to delete note'
                                )
                              );
                            }}
                          >
                            Delete
                          </Button>
                        </div>
                      </div>
                    </article>
                  );
                })}
                {notes.length > PAGE_SIZE ? (
                  <Pagination className="justify-start">
                    <PaginationContent>
                      <PaginationItem>
                        <PaginationPrevious
                          onClick={() => setNotesPage((prev) => Math.max(1, prev - 1))}
                          disabled={notesPage <= 1}
                        />
                      </PaginationItem>
                      <PaginationItem>
                        <span className="px-2 text-xs text-neutral-400">
                          {notesPage} / {notePages}
                        </span>
                      </PaginationItem>
                      <PaginationItem>
                        <PaginationNext
                          onClick={() => setNotesPage((prev) => Math.min(notePages, prev + 1))}
                          disabled={notesPage >= notePages}
                        />
                      </PaginationItem>
                    </PaginationContent>
                  </Pagination>
                ) : null}
              </div>
            ) : null}

            {!isInitializing && panel === 'new' ? (
              <div className="space-y-4">
                <h1 className="text-sm text-neutral-200">New note</h1>

                <div className="grid gap-3 md:grid-cols-2">
                  <label className="flex flex-col gap-1 text-xs">
                    <span>Title</span>
                    <input
                      value={noteTitle}
                      onChange={(event) => setNoteTitle(event.target.value)}
                      placeholder="Required title"
                      className="h-9 rounded-sm border border-neutral-800 bg-transparent px-2 text-sm text-neutral-100"
                    />
                  </label>
                </div>

                <div className="flex flex-wrap gap-2">
                  <Button
                    type="button"
                    variant="ghost"
                    className="h-7 border border-neutral-800 text-xs"
                    onClick={insertHeading}
                  >
                    H1
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    className="h-7 border border-neutral-800 text-xs"
                    onClick={() => wrapSelection('**', '**')}
                  >
                    Bold
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    className="h-7 border border-neutral-800 text-xs"
                    onClick={() => wrapSelection('*', '*')}
                  >
                    Italic
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    className="h-7 border border-neutral-800 text-xs"
                    onClick={() => wrapSelection('`', '`')}
                  >
                    Inline Code
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    className="h-7 border border-neutral-800 text-xs"
                    onClick={() => wrapSelection('\n```md\n', '\n```\n')}
                  >
                    Code Block
                  </Button>
                </div>

                <textarea
                  ref={editorRef}
                  value={content}
                  onChange={(event) => setContent(event.target.value)}
                  className="min-h-[22rem] w-full rounded-sm border border-neutral-800 bg-transparent p-3 text-sm text-neutral-200 outline-none focus:border-neutral-600"
                  placeholder="Write markdown content..."
                />

                <div className="grid gap-3 text-xs md:grid-cols-[max-content_max-content_1fr] md:items-end">
                  <label className="flex flex-col gap-1">
                    <span>Visibility</span>
                    <Combobox
                      items={[...visibilityOptions]}
                      value={visibility}
                      onValueChange={(next) =>
                        setVisibility(next === 'private' ? 'private' : 'public')
                      }
                    >
                      <ComboboxInput placeholder="Visibility" className={comboboxInputClass()} />
                      <ComboboxContent>
                        <ComboboxEmpty>No visibility found.</ComboboxEmpty>
                        <ComboboxList>
                          <ComboboxGroup>
                            {visibilityOptions.map((option) => (
                              <ComboboxItem key={option.value} value={option.value}>
                                {option.label}
                              </ComboboxItem>
                            ))}
                          </ComboboxGroup>
                        </ComboboxList>
                      </ComboboxContent>
                    </Combobox>
                  </label>

                  <label className="flex flex-col gap-1">
                    <span>Expire in</span>
                    <Combobox
                      items={[...expirationOptions]}
                      value={expirationValue}
                      onValueChange={(value) => {
                        const next = expirationOptions.find((option) => option.value === value);
                        if (next) setExpirationValue(next.value);
                      }}
                    >
                      <ComboboxInput placeholder="Expiration" className={comboboxInputClass()} />
                      <ComboboxContent>
                        <ComboboxEmpty>No duration found.</ComboboxEmpty>
                        <ComboboxList>
                          <ComboboxGroup>
                            {expirationOptions.map((option) => (
                              <ComboboxItem key={option.value} value={option.value}>
                                {option.label}
                              </ComboboxItem>
                            ))}
                          </ComboboxGroup>
                        </ComboboxList>
                      </ComboboxContent>
                    </Combobox>
                  </label>

                  <Button
                    type="button"
                    className="h-8 w-full md:w-auto"
                    onClick={() => {
                      void createNote().catch((err) =>
                        toast.error(err instanceof Error ? err.message : 'Failed to create note')
                      );
                    }}
                  >
                    Publish
                  </Button>
                </div>
              </div>
            ) : null}

            {!isInitializing && panel === 'links' ? (
              <div className="w-full space-y-4">
                <h1 className="text-sm text-neutral-200">Quick links</h1>

                <div className="rounded-sm border border-neutral-900 p-3">
                  <div className="grid gap-2 md:grid-cols-4">
                    <input
                      value={quickLinkKey}
                      onChange={(event) => setQuickLinkKey(event.target.value)}
                      placeholder="key (youtube)"
                      className="h-8 rounded-sm border border-neutral-800 bg-transparent px-2 text-xs"
                    />
                    <input
                      value={quickLinkUrl}
                      onChange={(event) => setQuickLinkUrl(event.target.value)}
                      placeholder="target url"
                      className="h-8 rounded-sm border border-neutral-800 bg-transparent px-2 text-xs md:col-span-2"
                    />
                    <input
                      value={quickLinkLabel}
                      onChange={(event) => setQuickLinkLabel(event.target.value)}
                      placeholder="label (optional)"
                      className="h-8 rounded-sm border border-neutral-800 bg-transparent px-2 text-xs"
                    />
                  </div>
                  <div className="mt-2">
                    <Button
                      type="button"
                      className="h-8 text-xs"
                      onClick={() => {
                        void createQuickLinkHandler().catch((err) =>
                          toast.error(
                            err instanceof Error ? err.message : 'Failed to create quick link'
                          )
                        );
                      }}
                    >
                      Add quick link
                    </Button>
                  </div>
                </div>

                {quickLinks.length === 0 ? (
                  <p className="text-xs text-neutral-500">No quick links yet.</p>
                ) : null}
                {visibleQuickLinks.map((link) => {
                  const isEditing = editingLinkId === link.id;
                  if (isEditing) {
                    return (
                      <article
                        key={link.id}
                        className="space-y-2 rounded-sm border border-neutral-900 p-3"
                      >
                        <div className="grid gap-2 md:grid-cols-4">
                          <input
                            value={editingLinkKey}
                            onChange={(event) => setEditingLinkKey(event.target.value)}
                            placeholder="key"
                            className="h-8 rounded-sm border border-neutral-800 bg-transparent px-2 text-xs"
                          />
                          <input
                            value={editingLinkUrl}
                            onChange={(event) => setEditingLinkUrl(event.target.value)}
                            placeholder="target url"
                            className="h-8 rounded-sm border border-neutral-800 bg-transparent px-2 text-xs md:col-span-2"
                          />
                          <input
                            value={editingLinkLabel}
                            onChange={(event) => setEditingLinkLabel(event.target.value)}
                            placeholder="label (optional)"
                            className="h-8 rounded-sm border border-neutral-800 bg-transparent px-2 text-xs"
                          />
                        </div>
                        <div className="flex items-center gap-2">
                          <Button
                            type="button"
                            variant="default"
                            className="h-8 text-xs"
                            onClick={() => {
                              void saveQuickLinkEdits(link.id).catch((err) =>
                                toast.error(
                                  err instanceof Error ? err.message : 'Failed to update quick link'
                                )
                              );
                            }}
                          >
                            Save
                          </Button>
                          <Button
                            type="button"
                            variant="ghost"
                            className="h-8 border border-neutral-800 text-xs"
                            onClick={cancelEditQuickLink}
                          >
                            Cancel
                          </Button>
                        </div>
                      </article>
                    );
                  }

                  return (
                    <article
                      key={link.id}
                      className="group cursor-pointer rounded-sm border border-neutral-900 px-3 py-3 transition-colors hover:bg-neutral-900/40"
                      role="link"
                      tabIndex={0}
                      onClick={() => {
                        router.push(`/${link.username}/${link.key}`);
                      }}
                      onKeyDown={(event) => {
                        if (event.key === 'Enter' || event.key === ' ') {
                          event.preventDefault();
                          router.push(`/${link.username}/${link.key}`);
                        }
                      }}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="truncate text-sm text-neutral-100">
                            /{link.username}/{link.key} {'>'} {link.targetUrl}
                          </p>
                          <p className="mt-1 text-[11px] text-neutral-500">
                            {link.label || 'quick link'} &middot; views {link.clicks}
                            {link.lastClickedAt ? ` · last ${formatDate(link.lastClickedAt)}` : ''}
                          </p>
                        </div>
                        <div className="flex items-center gap-2">
                          <Button
                            type="button"
                            variant="default"
                            className="h-8 text-xs"
                            onClick={(event) => {
                              event.stopPropagation();
                              startEditQuickLink(link);
                            }}
                          >
                            Edit
                          </Button>
                          <Button
                            type="button"
                            variant="default"
                            className="h-8 text-xs"
                            onClick={(event) => {
                              event.stopPropagation();
                              openInviteDialog('link', link.id);
                            }}
                          >
                            Share
                          </Button>
                          <Button
                            type="button"
                            variant="default"
                            className="h-8 text-xs"
                            onClick={(event) => {
                              event.stopPropagation();
                              void togglePin('link', link.id).catch((err) =>
                                toast.error(
                                  err instanceof Error ? err.message : 'Failed to toggle pin'
                                )
                              );
                            }}
                          >
                            {pinnedLinkIds.has(link.id) ? '<' : '>'}
                          </Button>
                          <Button
                            type="button"
                            variant="default"
                            className="h-8 text-xs"
                            onClick={(event) => {
                              event.stopPropagation();
                              void removeQuickLinkHandler(link.id).catch((err) =>
                                toast.error(
                                  err instanceof Error ? err.message : 'Failed to remove quick link'
                                )
                              );
                            }}
                          >
                            Delete
                          </Button>
                        </div>
                      </div>
                    </article>
                  );
                })}
                {quickLinks.length > PAGE_SIZE ? (
                  <Pagination className="justify-start">
                    <PaginationContent>
                      <PaginationItem>
                        <PaginationPrevious
                          onClick={() => setLinksPage((prev) => Math.max(1, prev - 1))}
                          disabled={linksPage <= 1}
                        />
                      </PaginationItem>
                      <PaginationItem>
                        <span className="px-2 text-xs text-neutral-400">
                          {linksPage} / {linksPages}
                        </span>
                      </PaginationItem>
                      <PaginationItem>
                        <PaginationNext
                          onClick={() => setLinksPage((prev) => Math.min(linksPages, prev + 1))}
                          disabled={linksPage >= linksPages}
                        />
                      </PaginationItem>
                    </PaginationContent>
                  </Pagination>
                ) : null}
              </div>
            ) : null}

            {!isInitializing && panel === 'profile' ? (
              <div className="space-y-4">
                <h1 className="text-sm text-neutral-200">Profile</h1>
                <div className="rounded-sm border border-neutral-900 p-3">
                  <p className="text-xs text-neutral-500">Public profile URL</p>
                  <CodeBlock className="mt-2" language="text">
                    {publicProfileUrl || 'Unavailable'}
                  </CodeBlock>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <Button
                      type="button"
                      className="h-8 text-xs"
                      disabled={!publicProfileUrl}
                      onClick={() => {
                        if (!publicProfileUrl) return;
                        window.open(publicProfileUrl, '_blank', 'noopener,noreferrer');
                      }}
                    >
                      Open public profile
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      className="h-8 border border-neutral-800 text-xs"
                      disabled={!publicProfileUrl}
                      onClick={() => {
                        if (!publicProfileUrl) return;
                        void navigator.clipboard.writeText(publicProfileUrl);
                        toast.success('Profile URL copied');
                      }}
                    >
                      Copy URL
                    </Button>
                  </div>
                </div>

                <div className="rounded-sm border border-neutral-900 p-3">
                  <p className="text-xs text-neutral-500">Profile summary</p>
                  <p className="mt-2 text-xs text-neutral-300">
                    @{profileHandle || 'unknown'} &middot; {notes.length} notes &middot; {quickLinks.length} links
                  </p>
                  <p className="mt-1 text-[11px] text-neutral-500">
                    Signed-in view stays dashboard. Public view forced via <code>?public=1</code>.
                  </p>
                </div>
              </div>
            ) : null}

            {!isInitializing && panel === 'settings' ? (
              <div className="space-y-4">
                <h1 className="text-sm text-neutral-200">Settings</h1>

                <div className="rounded-sm border border-neutral-900 p-3">
                  <p className="text-xs text-neutral-500">CLI install command</p>
                  <CodeBlock className="mt-2" language="bash">
                    {cliInstallCommand}
                  </CodeBlock>
                </div>

                <div className="rounded-sm border border-neutral-900 p-3">
                  <p className="text-xs text-neutral-500">Generate API key</p>
                  <div className="mt-3 flex flex-wrap items-end gap-3">
                    <label className="flex flex-col gap-1">
                      <span className="text-[11px] text-neutral-500">Label</span>
                      <input
                        value={keyLabel}
                        onChange={(event) => setKeyLabel(event.target.value)}
                        placeholder="label"
                        className="h-8 rounded-sm border border-neutral-800 bg-transparent px-2 text-xs"
                      />
                    </label>

                    <label className="flex flex-col gap-1">
                      <span className="text-[11px] text-neutral-500">Permissions</span>
                      <Combobox
                        items={[...permissionOptions]}
                        value={keyPermissions}
                        onValueChange={(value) => {
                          if (value === 'read' || value === 'write' || value === 'read_write') {
                            setKeyPermissions(value);
                          }
                        }}
                      >
                        <ComboboxInput
                          placeholder="Permissions"
                          className={comboboxInputClass('w-44')}
                        />
                        <ComboboxContent>
                          <ComboboxEmpty>No permission found.</ComboboxEmpty>
                          <ComboboxList>
                            <ComboboxGroup>
                              {permissionOptions.map((option) => (
                                <ComboboxItem key={option.value} value={option.value}>
                                  {option.label}
                                </ComboboxItem>
                              ))}
                            </ComboboxGroup>
                          </ComboboxList>
                        </ComboboxContent>
                      </Combobox>
                    </label>

                    <Button
                      type="button"
                      className="h-8 text-xs"
                      onClick={() => {
                        void generateApiKey().catch((err) =>
                          toast.error(err instanceof Error ? err.message : 'Failed to generate key')
                        );
                      }}
                    >
                      Generate
                    </Button>
                  </div>

                  {generatedApiKey ? (
                    <div className="mt-3 rounded-sm border border-neutral-900 p-2">
                      <p className="text-[11px] text-neutral-300">Save now. shown once:</p>
                      <CodeBlock className="mt-1" language="text">
                        {generatedApiKey}
                      </CodeBlock>
                    </div>
                  ) : null}
                </div>

                <div className="rounded-sm border border-neutral-900 p-3">
                  <p className="text-xs text-neutral-500">Your API keys</p>
                  <div className="mt-2 space-y-2">
                    {apiKeys.length === 0 ? (
                      <p className="text-xs text-neutral-500">No API keys yet.</p>
                    ) : null}
                    {apiKeys.map((key) => (
                      <div
                        key={key.id}
                        className="flex items-center justify-between gap-2 rounded-sm border border-neutral-900 px-2 py-2"
                      >
                        <div className="min-w-0">
                          <p className="truncate text-xs text-neutral-200">{key.label || 'api key'}</p>
                          <p className="text-[11px] text-neutral-500">
                            {key.prefix} &middot; {key.permissions} &middot; created {formatDate(key.createdAt)}
                          </p>
                        </div>
                        <Button
                          type="button"
                          variant="ghost"
                          className="h-8 border border-neutral-800 text-xs"
                          onClick={() => {
                            void revokeKey(key.id).catch((err) =>
                              toast.error(err instanceof Error ? err.message : 'Failed to revoke key')
                            );
                          }}
                        >
                          Revoke
                        </Button>
                      </div>
                    ))}
                  </div>
                </div>

                {analytics ? (
                  <Card className="w-full rounded-sm border border-neutral-900 bg-transparent py-0 ring-0">
                    <CardHeader className="border-b border-neutral-900 px-4 py-3">
                      <CardTitle className="text-sm text-neutral-200">Analytics ({analytics.days}d)</CardTitle>
                      <CardDescription className="text-xs text-neutral-500">
                        Total views: {analytics.totalViews.toLocaleString()}
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="px-2 py-3 sm:p-4">
                      <ChartContainer
                        config={chartConfig}
                        className="h-[240px] min-h-[240px] w-full !aspect-auto"
                        style={{ height: 240, maxHeight: 240 }}
                      >
                        <BarChart
                          accessibilityLayer
                          data={chartData}
                          margin={{
                            left: 12,
                            right: 12,
                          }}
                        >
                          <CartesianGrid vertical={false} />
                          <XAxis
                            dataKey="date"
                            tickLine={false}
                            axisLine={false}
                            tickMargin={8}
                            minTickGap={36}
                            tickFormatter={formatChartDate}
                          />
                          <ChartTooltip
                            cursor={false}
                            content={
                              <ChartTooltipContent
                                className="w-[180px]"
                                labelFormatter={(value) => {
                                  const date = new Date(`${String(value)}T00:00:00.000Z`);
                                  if (Number.isNaN(date.getTime())) return String(value);
                                  return date.toLocaleDateString('en-US', {
                                    month: 'short',
                                    day: 'numeric',
                                    year: 'numeric',
                                  });
                                }}
                              />
                            }
                          />
                          <Bar
                            dataKey="pageViews"
                            radius={2}
                            fill="var(--color-pageViews)"
                            maxBarSize={24}
                          />
                          <Bar
                            dataKey="linkClicks"
                            radius={2}
                            fill="var(--color-linkClicks)"
                            fillOpacity={0.55}
                            maxBarSize={24}
                          />
                        </BarChart>
                      </ChartContainer>
                    </CardContent>
                  </Card>
                ) : null}
              </div>
            ) : null}

            {!isInitializing && panel === 'deleted' ? (
              <div className="w-full space-y-3">
                <h1 className="text-sm text-neutral-200">Recently deleted</h1>
                {deletedNotes.length === 0 ? (
                  <p className="text-xs text-neutral-500">No recently deleted notes.</p>
                ) : null}
                {visibleDeletedNotes.map((note) => (
                  <article
                    key={note.id}
                    className="group rounded-sm border border-neutral-900 px-3 py-3"
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div className="min-w-0">
                        <p className="text-sm text-neutral-200">
                          {note.title}
                        </p>
                        <p className="mt-1 text-[11px] text-neutral-500">
                          deleted {formatDate(note.deletedAt)} &middot; permanent delete{' '}
                          {formatDate(note.purgeAt)}
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <Button
                          type="button"
                          variant="ghost"
                          className="h-8 border border-neutral-800 text-xs"
                          onClick={() => {
                            void patchNote(note.id, 'restore').catch((err) =>
                              toast.error(err instanceof Error ? err.message : 'Failed to restore note')
                            );
                          }}
                        >
                          Restore
                        </Button>
                        <Button
                          type="button"
                          variant="default"
                          className="h-8 text-xs"
                          onClick={() => {
                            void patchNote(note.id, 'permanentDelete').catch((err) =>
                              toast.error(
                                err instanceof Error
                                  ? err.message
                                  : 'Failed to permanently delete note'
                              )
                            );
                          }}
                        >
                          Delete forever
                        </Button>
                      </div>
                    </div>
                  </article>
                ))}
                {deletedNotes.length > PAGE_SIZE ? (
                  <Pagination className="justify-start">
                    <PaginationContent>
                      <PaginationItem>
                        <PaginationPrevious
                          onClick={() => setDeletedPage((prev) => Math.max(1, prev - 1))}
                          disabled={deletedPage <= 1}
                        />
                      </PaginationItem>
                      <PaginationItem>
                        <span className="px-2 text-xs text-neutral-400">
                          {deletedPage} / {deletedPages}
                        </span>
                      </PaginationItem>
                      <PaginationItem>
                        <PaginationNext
                          onClick={() => setDeletedPage((prev) => Math.min(deletedPages, prev + 1))}
                          disabled={deletedPage >= deletedPages}
                        />
                      </PaginationItem>
                    </PaginationContent>
                  </Pagination>
                ) : null}
              </div>
            ) : null}
          </div>
        </section>
        <Dialog
          open={inviteDialogOpen}
          onOpenChange={(open) => {
            setInviteDialogOpen(open);
            if (!open) {
              setInviteTargetKind(null);
              setInviteTargetId(null);
              setInviteeUsername('');
              setIsSubmittingInvite(false);
            }
          }}
        >
          <DialogContent className="max-w-md border border-neutral-900 bg-bg text-neutral-100 ring-0">
            <DialogHeader>
              <DialogTitle className="text-sm text-neutral-100">Share with user</DialogTitle>
              <DialogDescription className="text-xs text-neutral-400">
                Invite by username. Access granted even when note stays private.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-2">
              <label className="text-xs text-neutral-400">Username</label>
              <input
                value={inviteeUsername}
                onChange={(event) => setInviteeUsername(event.target.value)}
                placeholder="e.g. egeuysall"
                className="h-9 w-full rounded-sm border border-neutral-700 bg-transparent px-2 text-sm text-neutral-100 placeholder:text-neutral-500"
                autoFocus
              />
            </div>
            <DialogFooter className="-mx-0 -mb-0 rounded-none border-0 bg-transparent p-0 pt-2">
              <Button
                type="button"
                variant="ghost"
                className="h-8 border border-neutral-800 text-xs text-neutral-200 hover:bg-neutral-900"
                onClick={() => {
                  setInviteDialogOpen(false);
                  setInviteTargetKind(null);
                  setInviteTargetId(null);
                  setInviteeUsername('');
                }}
              >
                Cancel
              </Button>
              <Button
                type="button"
                className="h-8 border border-neutral-700 bg-neutral-100 text-xs text-neutral-950 hover:bg-neutral-200"
                disabled={isSubmittingInvite}
                onClick={() => {
                  void submitInvite().catch((err) =>
                    toast.error(err instanceof Error ? err.message : 'Failed to invite user')
                  );
                }}
              >
                {isSubmittingInvite ? 'Sharing...' : 'Share'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <div className="fixed right-6 top-4 z-30 hidden xl:block">
          <div
            className="relative pb-1"
            onMouseEnter={() => setNotificationsPanelOpen(true)}
            onMouseLeave={() => setNotificationsPanelOpen(false)}
          >
            <Button
              type="button"
              variant="ghost"
              className="h-8 px-2 font-mono text-xs"
              aria-expanded={notificationsPanelOpen}
              aria-label="Open notifications"
              onClick={() => setNotificationsPanelOpen((prev) => !prev)}
            >
              ...
            </Button>
            {notificationsPanelOpen ? (
              <aside className="absolute right-0 top-full w-80 rounded-sm border border-neutral-900 bg-bg p-3 shadow-lg">
                <div className="space-y-4">
                  <section className="space-y-1">
                    <h2 className="text-xs text-neutral-400">invitations</h2>
                    {invitationNotifications.length === 0 ? (
                      <p className="text-[11px] text-neutral-500">none</p>
                    ) : (
                      invitationNotifications.map((row) => (
                        <div key={row.id} className="flex items-start gap-2">
                          <button
                            type="button"
                            className="flex-1 text-left text-[11px] text-neutral-300 transition-colors hover:text-neutral-100"
                            onClick={() => {
                              void openNotification(row.id).catch((err) =>
                                toast.error(
                                  err instanceof Error
                                    ? err.message
                                    : 'Failed to open notification'
                                )
                              );
                            }}
                          >
                            {row.message}
                          </button>
                          <Button
                            type="button"
                            variant="ghost"
                            className="h-5 min-w-5 px-1 text-[11px]"
                            onClick={() => {
                              void dismissNotification(row.id).catch((err) =>
                                toast.error(
                                  err instanceof Error
                                    ? err.message
                                    : 'Failed to dismiss notification'
                                )
                              );
                            }}
                          >
                            -
                          </Button>
                        </div>
                      ))
                    )}
                  </section>
                  <section className="space-y-1">
                    <h2 className="text-xs text-neutral-400">achievements</h2>
                    {achievementItems.length === 0 ? (
                      <p className="text-[11px] text-neutral-500">none yet</p>
                    ) : (
                      achievementItems.map((row) => (
                        <div key={row.id} className="flex items-start gap-2">
                          <p className="flex-1 text-[11px] text-neutral-300">{row.message}</p>
                          <Button
                            type="button"
                            variant="ghost"
                            className="h-5 min-w-5 px-1 text-[11px]"
                            onClick={() => dismissAchievement(row.id)}
                          >
                            -
                          </Button>
                        </div>
                      ))
                    )}
                  </section>
                  <section className="space-y-1">
                    <h2 className="text-xs text-neutral-400">notices</h2>
                    {noticeItems.length === 0 ? (
                      <p className="text-[11px] text-neutral-500">none</p>
                    ) : (
                      noticeItems.map((row) => (
                        <div key={row.id} className="flex items-start gap-2">
                          <p className="flex-1 text-[11px] text-neutral-300">{row.message}</p>
                          <Button
                            type="button"
                            variant="ghost"
                            className="h-5 min-w-5 px-1 text-[11px]"
                            onClick={() => dismissNotice(row.id)}
                          >
                            -
                          </Button>
                        </div>
                      ))
                    )}
                  </section>
                </div>
              </aside>
            ) : null}
          </div>
        </div>
      </SidebarInset>
    </SidebarProvider>
  );
}
