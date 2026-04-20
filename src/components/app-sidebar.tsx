'use client';

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

export type DashboardPanel = 'notes' | 'new' | 'settings' | 'deleted';

function SidebarSlashToggle() {
  const { state, toggleSidebar } = useSidebar();
  const isCollapsed = state === 'collapsed';

  return (
    <Button
      type="button"
      variant="ghost"
      onClick={toggleSidebar}
      className={isCollapsed ? 'size-8 justify-center px-0 text-xs tracking-wide' : 'h-8 justify-start px-2 text-xs tracking-wide'}
    >
      {'///'}
    </Button>
  );
}

const panelItems: Array<{ id: DashboardPanel; label: string }> = [
  { id: 'notes', label: 'notes' },
  { id: 'new', label: 'new note' },
  { id: 'settings', label: 'settings' },
  { id: 'deleted', label: 'deleted' },
];

export function AppSidebar({
  panel,
  onPanelChange,
  ...props
}: React.ComponentProps<typeof Sidebar> & {
  panel: DashboardPanel;
  onPanelChange: (panel: DashboardPanel) => void;
}) {
  const { state } = useSidebar();
  const isCollapsed = state === 'collapsed';
  const iconByPanel: Record<DashboardPanel, string> = {
    notes: '[',
    new: ']',
    settings: '>',
    deleted: '<',
  };

  return (
    <Sidebar collapsible="icon" className="border-r border-neutral-900" {...props}>
      <SidebarHeader className="border-b border-neutral-900 px-3 py-2">
        <div className={isCollapsed ? 'flex items-center justify-center' : 'flex items-center justify-start'}>
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
                  <span className="font-mono text-xs">{iconByPanel[item.id]}</span>
                ) : (
                  <span>{item.label}</span>
                )}
              </SidebarMenuButton>
            </SidebarMenuItem>
          ))}
        </SidebarMenu>
      </SidebarContent>

      <SidebarFooter className="border-t border-neutral-900 p-2">
        <NavUser />
      </SidebarFooter>
    </Sidebar>
  );
}
