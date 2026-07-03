"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChevronsLeft, ChevronsRight } from "lucide-react";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar";
import { Button } from "@/components/ui/button";
import { SidebarThemePicker } from "@/components/shell/sidebar-theme-picker";
import { useAppTheme } from "@/components/shell/app-theme-provider";
import { useSidebarExpand } from "@/hooks/use-sidebar-expand";
import type { NavGroup } from "@/components/shell/dashboard-nav";
import type { UserRole } from "@/types/domain";
import { BrandMark } from "@/components/shell/brand-mark";
import { cn } from "@/lib/utils";
import { createClient } from "@/lib/supabase/client";
import { useEffect, useState } from "react";

function NavLink({
  href,
  active,
  label,
  shortLabel,
  icon: Icon,
  expanded,
}: {
  href: string;
  active: boolean;
  label: string;
  shortLabel?: string;
  icon: NavGroup["items"][number]["icon"];
  expanded: boolean;
}) {
  const { setOpenMobile, isMobile } = useSidebar();

  return (
    <SidebarMenuButton
      asChild
      isActive={active}
      tooltip={expanded || isMobile ? undefined : label}
      className="sidebar-rail-item min-h-11"
    >
      <Link
        href={href}
        onClick={() => {
          if (isMobile) setOpenMobile(false);
        }}
      >
        <Icon
          strokeWidth={1.85}
          className={cn("shrink-0", expanded ? "h-[1.1875rem] w-[1.1875rem]" : "h-[1.6875rem] w-[1.6875rem]")}
        />
        <span>{expanded ? label : (shortLabel ?? label)}</span>
      </Link>
    </SidebarMenuButton>
  );
}

export function DashboardSidebar({
  groups,
  role,
}: {
  groups: NavGroup[];
  role: UserRole;
}) {
  const pathname = usePathname();
  const { themeId, setThemeId, mode, setMode } = useAppTheme();
  const { expanded, toggle, layout, isMobile } = useSidebarExpand();
  const { isMobile: sidebarMobile } = useSidebar();
  const [userLabel, setUserLabel] = useState<string>("");

  useEffect(() => {
    const supabase = createClient();
    void supabase.auth.getUser().then(async ({ data: { user } }) => {
      if (!user) return;
      const { data } = await supabase.from("profiles").select("full_name, email").eq("id", user.id).single();
      setUserLabel(data?.full_name?.trim() || data?.email || user.email || "");
    });
  }, []);

  // Mobile drawer: use expanded labels so items are readable. Desktop: rail or expanded.
  const navLayout = sidebarMobile ? "expanded" : layout;
  const navExpanded = sidebarMobile || expanded;

  return (
    <Sidebar
      collapsible={sidebarMobile ? "offcanvas" : "none"}
      data-sidebar-layout={navLayout}
      data-sidebar-expanded={navExpanded ? "true" : "false"}
      className="shrink-0 border-r-0 border-sidebar-border bg-sidebar text-sidebar-foreground shadow-none"
      style={
        sidebarMobile
          ? ({ "--sidebar-width": "18rem" } as React.CSSProperties)
          : undefined
      }
    >
      <SidebarHeader className="shrink-0 border-b border-sidebar-border/60 px-2 py-4">
        {navExpanded ? (
          <div className="flex items-center justify-between gap-2 px-1">
            <Link
              href="/dashboard"
              className="flex min-w-0 items-center gap-2.5 text-sidebar-foreground transition-opacity hover:opacity-90"
            >
              <div className="sidebar-brand-mark flex h-[2.625rem] w-[2.625rem] shrink-0 items-center justify-center rounded-[0.875rem] bg-zinc-950 text-white shadow-[inset_0_1px_0_rgb(255_255_255/0.16),0_1px_2px_rgb(0_0_0/0.12)]">
                <BrandMark className="h-[1.375rem] w-[1.375rem]" />
              </div>
              <span className="truncate text-[1rem] font-extrabold tracking-[-0.035em] text-zinc-950">RealSite</span>
            </Link>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="size-8 shrink-0 rounded-xl text-zinc-500 hover:bg-zinc-100 hover:text-zinc-950"
              onClick={toggle}
              aria-label="Collapse sidebar"
            >
              <ChevronsLeft className="h-4 w-4" />
            </Button>
          </div>
        ) : (
          <div className="flex flex-col items-center">
            <Link
              href="/dashboard"
              className="flex flex-col items-center gap-2 text-sidebar-foreground transition-opacity hover:opacity-90"
            >
              <div className="sidebar-brand-mark flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-white text-zinc-700 shadow-[0_1px_2px_rgb(0_0_0/0.08),0_0_0_1px_rgb(0_0_0/0.08)]">
                <BrandMark className="h-6 w-6" />
              </div>
            </Link>
            <p className="mt-1 text-center text-[10px] font-medium capitalize tracking-wide text-zinc-500">
              {role.replace(/_/g, " ")}
            </p>
            {!isMobile && (
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="mt-2 size-8 rounded-xl text-zinc-500 hover:bg-zinc-100 hover:text-zinc-950"
                onClick={toggle}
                aria-label="Expand sidebar"
              >
                <ChevronsRight className="h-4 w-4" />
              </Button>
            )}
          </div>
        )}
      </SidebarHeader>

      <SidebarContent className="min-h-0 flex-1 gap-0 overflow-y-auto overflow-x-hidden py-0.5">
        {groups.map((group) => (
          <SidebarGroup key={group.label}>
            {navExpanded && (
              <SidebarGroupLabel className="px-3 text-[0.8125rem] font-semibold capitalize tracking-[-0.01em] text-zinc-500">
                {group.label}
              </SidebarGroupLabel>
            )}
            <SidebarMenu>
              {group.items.map((item) => {
                const Icon = item.icon;
                const active =
                  item.href === "/dashboard/brochures"
                    ? pathname === item.href || /^\/dashboard\/brochures\/[0-9a-f-]{36}(\/(sessions|reports).*)?$/i.test(pathname)
                    : pathname === item.href ||
                      (item.href !== "/dashboard" && pathname.startsWith(item.href + "/"));
                return (
                  <SidebarMenuItem key={item.href}>
                    <NavLink
                      href={item.href}
                      active={active}
                      label={item.label}
                      shortLabel={item.shortLabel}
                      icon={Icon}
                      expanded={navExpanded}
                    />
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarGroup>
        ))}
      </SidebarContent>

      <SidebarFooter className="sidebar-theme-footer mt-auto shrink-0 border-t border-sidebar-border/60 bg-sidebar p-0">
        {userLabel && navExpanded && (
          <div className="border-b border-sidebar-border/60 px-4 py-3">
            <p className="truncate text-xs font-semibold text-zinc-950">{userLabel}</p>
            <p className="truncate text-[10px] capitalize text-zinc-500">{role.replace(/_/g, " ")}</p>
          </div>
        )}
        <SidebarThemePicker value={themeId} mode={mode} onChange={setThemeId} onModeChange={setMode} />
      </SidebarFooter>
    </Sidebar>
  );
}
