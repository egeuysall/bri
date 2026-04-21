'use client';

import Link from 'next/link';
import { NavUser } from '@/components/nav-user';
import { Button } from '@/components/ui/button';
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from '@/components/ui/sidebar';

type SidebarPinnedItem = {
  id: string;
  title: string;
  href: string;
  count?: number;
};

export type DashboardPanel = 'notes' | 'new' | 'links' | 'settings' | 'deleted';

function SidebarSlashToggle() {
  const { state, toggleSidebar } = useSidebar();
  const isCollapsed = state === 'collapsed';

  return (
    <Button
      type="button"
      variant="ghost"
      onClick={toggleSidebar}
      className={
        isCollapsed
          ? 'size-8 justify-start px-1 text-xs tracking-wide'
          : 'h-8 w-full justify-start px-1 text-xs tracking-wide'
      }
    >
      {'///'}
    </Button>
  );
}

const panelItems: Array<{ id: DashboardPanel; label: string }> = [
  { id: 'notes', label: 'notes' },
  { id: 'new', label: 'new note' },
  { id: 'links', label: 'links' },
  { id: 'settings', label: 'settings' },
  { id: 'deleted', label: 'deleted' },
];

export function AppSidebar({
  panel,
  pinnedItems,
  onPanelChange,
  ...props
}: React.ComponentProps<typeof Sidebar> & {
  panel: DashboardPanel;
  pinnedItems: SidebarPinnedItem[];
  onPanelChange: (panel: DashboardPanel) => void;
}) {
  const { state } = useSidebar();
  const isCollapsed = state === 'collapsed';
  const iconByPanel: Record<DashboardPanel, string> = {
    notes: '[',
    new: '<',
    links: '>',
    settings: '{',
    deleted: ']',
  };

  return (
    <Sidebar collapsible="icon" className="border-r border-neutral-900" {...props}>
      <SidebarHeader className="border-b border-neutral-900 px-3 py-2">
        <div className="flex items-center justify-start">
          <SidebarSlashToggle />
        </div>
      </SidebarHeader>

      <SidebarContent className="px-2 py-3">
        <SidebarMenu>
          {panelItems.map(item => (
            <SidebarMenuItem key={item.id}>
              <SidebarMenuButton
                isActive={panel === item.id}
                onClick={() => onPanelChange(item.id)}
                className="text-xs data-active:bg-neutral-900 data-active:text-neutral-100"
              >
                {isCollapsed ? (
                  <span className="font-mono text-[10px] leading-none">{iconByPanel[item.id]}</span>
                ) : (
                  <span>{item.label}</span>
                )}
              </SidebarMenuButton>
            </SidebarMenuItem>
          ))}
        </SidebarMenu>

        {!isCollapsed ? (
          <div className="mt-4 border-t border-neutral-900 pt-3">
            <p className="px-2 pb-2 text-[11px] text-neutral-500">pinned</p>
            {pinnedItems.length === 0 ? (
              <p className="px-2 text-[11px] text-neutral-500">none</p>
            ) : (
              <ul className="space-y-1 px-1">
                {pinnedItems.slice(0, 8).map((item) => (
                  <li key={item.id}>
                    <Link
                      href={item.href}
                      className="flex items-center justify-between gap-2 rounded-sm px-2 py-1 text-xs text-neutral-300 hover:bg-neutral-900/70 hover:text-neutral-100"
                    >
                      <span className="truncate">{item.title}</span>
                      <span className="shrink-0 text-[11px] text-neutral-500">
                        {item.count ?? 0}
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </div>
        ) : null}
      </SidebarContent>

      <SidebarFooter className="border-t border-neutral-900 p-2">
        <NavUser />
      </SidebarFooter>
    </Sidebar>
  );
}
