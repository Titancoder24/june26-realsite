"use client";

import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/client";
import {
  SidebarInset,
  SidebarProvider,
  SidebarTrigger,
} from "@/components/ui/sidebar";
import { AdminSidebar } from "@/components/admin/admin-sidebar";

const NO_SHELL_PATHS = ["/admin/login", "/admin/setup"];

export function AdminShellGate({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  if (NO_SHELL_PATHS.includes(pathname)) return <>{children}</>;
  return <AdminAppShell>{children}</AdminAppShell>;
}

function AdminAppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [provider, setProvider] = useState<"openrouter" | "vertex" | undefined>();
  const [signingOut, setSigningOut] = useState(false);

  useEffect(() => {
    document.documentElement.dataset.shell = "super-admin";
    return () => {
      delete document.documentElement.dataset.shell;
    };
  }, []);

  useEffect(() => {
    fetch("/api/admin/walkthrough-ai")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => d && setProvider(d.provider))
      .catch(() => {});
  }, [pathname]);

  async function signOut() {
    setSigningOut(true);
    const supabase = createClient();
    await supabase.auth.signOut();
    router.replace("/admin/login");
    router.refresh();
  }

  const title =
    pathname === "/admin"
      ? "Platform Analytics"
      : pathname.includes("image-walkthrough")
        ? "Image Walkthrough"
        : pathname.includes("walkthrough-ai")
          ? "Property Walkthrough AI"
          : pathname.includes("worldlabs")
          ? "World Labs"
          : pathname.includes("engines")
            ? "Engine Control"
            : pathname.includes("models")
              ? "Models & Voice"
              : pathname.includes("audit")
                ? "Audit Logs"
                : "Super Admin";

  return (
    <SidebarProvider key="super-admin-shell" defaultOpen>
      <div className="flex min-h-svh w-full bg-muted/20" data-shell="super-admin">
        <AdminSidebar activeProvider={provider} />
        <SidebarInset className="flex min-h-svh flex-col overflow-x-hidden bg-background">
          <header className="sticky top-0 z-40 flex h-16 shrink-0 items-center gap-3 border-b border-border/60 bg-background/95 px-4 backdrop-blur-md">
            <SidebarTrigger className="size-11 shrink-0" />
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold">{title}</p>
              <p className="truncate text-xs text-muted-foreground">Super Admin Panel</p>
            </div>
            <div className="flex shrink-0 items-center gap-2">
              <Button
                size="sm"
                variant="outline"
                className="hidden sm:inline-flex"
                onClick={signOut}
                disabled={signingOut}
              >
                <LogOut className="mr-1.5 h-4 w-4" />
                Sign out
              </Button>
              <Button
                size="icon"
                variant="ghost"
                className="size-11 sm:hidden"
                onClick={signOut}
                disabled={signingOut}
                aria-label="Sign out"
              >
                <LogOut className="h-4 w-4" />
              </Button>
            </div>
          </header>
          <main className="flex flex-1 flex-col overflow-x-hidden px-4 py-5 md:px-6 md:py-6">
            {children}
          </main>
        </SidebarInset>
      </div>
    </SidebarProvider>
  );
}
