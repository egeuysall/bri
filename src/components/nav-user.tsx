"use client"

import { UserButton } from "@clerk/nextjs"
import { useUser } from "@clerk/nextjs"
import {
  SidebarMenu,
  SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar"

export function NavUser() {
  const { state } = useSidebar()
  const { isLoaded, user } = useUser()
  const isCollapsed = state === "collapsed"
  const username =
    user?.username ||
    user?.primaryEmailAddress?.emailAddress?.split("@")[0] ||
    ""
  const email = user?.primaryEmailAddress?.emailAddress || ""

  if (!isLoaded) {
    return (
      <SidebarMenu>
        <SidebarMenuItem>
          <div
            className={
              isCollapsed
                ? "h-6 w-6 animate-pulse rounded-full bg-neutral-900"
                : "h-8 w-full animate-pulse rounded-sm bg-neutral-900"
            }
          />
        </SidebarMenuItem>
      </SidebarMenu>
    )
  }

  return (
    <SidebarMenu>
      <SidebarMenuItem>
        <div className={isCollapsed ? "flex justify-center" : "flex items-center gap-2"}>
          <UserButton
            appearance={{
              elements: {
                avatarBox: isCollapsed ? "size-6" : "size-8",
              },
            }}
          />
          {!isCollapsed ? (
            <div className="grid min-w-0 text-left text-sm leading-tight">
              <span className="truncate text-neutral-200">{username}</span>
              <span className="truncate text-xs text-neutral-500">{email}</span>
            </div>
          ) : null}
        </div>
      </SidebarMenuItem>
    </SidebarMenu>
  )
}
