"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { Plus, Search, Settings2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  SidebarInset,
  SidebarProvider,
  SidebarTrigger,
} from "@/components/ui/sidebar";
import { useUserRole, canAccessRoute } from "@/components/auth/role-guard";
import { DashboardSidebar } from "@/components/shell/dashboard-sidebar";
import { AppThemeProvider, useAppTheme } from "@/components/shell/app-theme-provider";
import { AppThemeToggle } from "@/components/shell/app-theme-toggle";
import { getVisibleNavGroups } from "@/components/shell/dashboard-nav";
import { SidebarExpandProvider, useSidebarExpand } from "@/hooks/use-sidebar-expand";
import { cn } from "@/lib/utils";

function DashboardShellInner({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { role } = useUserRole();
  const visibleGroups = getVisibleNavGroups(role);
  const { mode, styleVars, ready: themeReady } = useAppTheme();
  const [mobileSearchOpen, setMobileSearchOpen] = useState(false);

  useEffect(() => {
    document.documentElement.dataset.shell = "dashboard";
    return () => {
      delete document.documentElement.dataset.shell;
    };
  }, []);

  useEffect(() => {
    setMobileSearchOpen(false);
  }, [pathname]);

  const isFullscreenRoute = pathname.includes("/dashboard/capture/");

  return (
    <div
      className={cn(
        "flex min-h-svh w-full min-w-0 transition-colors duration-300",
        mode === "dark" ? "dashboard-canvas-dark" : "dashboard-canvas-light",
      )}
      style={themeReady ? styleVars : undefined}
    >
      <DashboardSidebar groups={visibleGroups} role={role} />
      <SidebarInset className="dashboard-workspace-main flex min-h-svh min-w-0 flex-1 flex-col overflow-x-hidden bg-transparent">
        {!isFullscreenRoute && (
          <header
            className="dashboard-shell-header sticky top-0 z-40 shrink-0"
            style={{ paddingTop: "max(0px, env(safe-area-inset-top))" }}
          >
            <div className="grid h-16 grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-2 px-3 sm:grid-cols-[auto_1fr_auto] sm:gap-4 sm:px-6">
              <div className="flex min-w-0 items-center gap-2 md:hidden">
                <SidebarTrigger className="dashboard-shell-trigger size-11 shrink-0" />
              </div>
              <div className="hidden min-w-0 md:block" aria-hidden />

              <div className="hidden min-w-0 justify-center px-2 md:flex">
                <div className="dashboard-shell-search-wrap relative w-full max-w-[28rem]">
                  <Search className="pointer-events-none absolute left-4 top-1/2 h-[1.125rem] w-[1.125rem] -translate-y-1/2 text-muted-foreground" strokeWidth={1.75} />
                  <Input
                    placeholder="Search developments, listings, leads…"
                    className="dashboard-shell-search h-11 w-full rounded-xl pl-11 pr-4 text-sm transition-all duration-200 ease-out focus-visible:ring-2 focus-visible:ring-sidebar-primary/30 focus-visible:ring-offset-0"
                  />
                </div>
              </div>

              <div className="dashboard-shell-actions flex shrink-0 items-center gap-1 rounded-xl border p-1 sm:gap-2 sm:px-2">
                <Button
                  size="icon"
                  variant="ghost"
                  className="dashboard-shell-icon-btn size-11 md:hidden"
                  onClick={() => setMobileSearchOpen((open) => !open)}
                  aria-label={mobileSearchOpen ? "Close search" : "Open search"}
                >
                  {mobileSearchOpen ? <X className="h-5 w-5" /> : <Search className="h-5 w-5" />}
                </Button>
                <AppThemeToggle className="dashboard-shell-theme-toggle" />
                {canAccessRoute(role, "/dashboard/projects") && (
                  <Button size="sm" variant="default" className="dashboard-shell-cta hidden h-11 px-4 lg:inline-flex" asChild>
                    <Link href="/dashboard/projects/new">
                      <Plus className="mr-1.5 h-4 w-4" />
                      Development
                    </Link>
                  </Button>
                )}
                <Button size="icon" variant="ghost" className="dashboard-shell-icon-btn size-11 lg:hidden" asChild>
                  <Link href="/dashboard/projects/new" aria-label="New development">
                    <Plus className="h-5 w-5" />
                  </Link>
                </Button>
                <Button size="icon" variant="ghost" className="dashboard-shell-icon-btn size-11" asChild>
                  <Link href="/dashboard/settings" aria-label="Workspace settings">
                    <Settings2 className="h-4 w-4" />
                  </Link>
                </Button>
              </div>
            </div>

            {mobileSearchOpen && (
              <div className="border-t border-sidebar-border/60 px-3 py-3 md:hidden">
                <div className="dashboard-shell-search-wrap relative">
                  <Search className="pointer-events-none absolute left-4 top-1/2 h-[1.125rem] w-[1.125rem] -translate-y-1/2 text-muted-foreground" strokeWidth={1.75} />
                  <Input
                    autoFocus
                    placeholder="Search developments, listings, leads…"
                    className="dashboard-shell-search h-11 w-full rounded-xl pl-11 pr-4 text-sm focus-visible:ring-2 focus-visible:ring-sidebar-primary/30"
                  />
                </div>
              </div>
            )}
          </header>
        )}

        <main
          className={
            isFullscreenRoute
              ? "flex min-w-0 flex-1 flex-col overflow-hidden"
              : cn(
                  "flex min-w-0 flex-1 flex-col overflow-x-hidden px-5 py-6 sm:px-8 sm:py-8 md:px-10 md:py-10",
                  mode === "dark" && "dashboard-main-dark",
                )
          }
        >
          {children}
        </main>
      </SidebarInset>
    </div>
  );
}

export function SpatialSalesAppShell({ children }: { children: React.ReactNode }) {
  return (
    <AppThemeProvider>
      <SidebarExpandProvider>
        <DashboardShellWithSidebar>{children}</DashboardShellWithSidebar>
      </SidebarExpandProvider>
    </AppThemeProvider>
  );
}

function DashboardShellWithSidebar({ children }: { children: React.ReactNode }) {
  const { sidebarWidth, ready: expandReady } = useSidebarExpand();

  return (
    <SidebarProvider
      key="dashboard-shell"
      defaultOpen
      className="dashboard-workspace min-h-svh w-full min-w-0"
      style={
        expandReady
          ? ({ "--sidebar-width": sidebarWidth } as React.CSSProperties)
          : undefined
      }
    >
      <DashboardShellInner>{children}</DashboardShellInner>
    </SidebarProvider>
  );
}
