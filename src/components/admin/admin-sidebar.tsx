"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
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
  SidebarRail,
  useSidebar,
} from "@/components/ui/sidebar";
import { ADMIN_NAV_GROUPS } from "@/components/admin/admin-nav";
import { Badge } from "@/components/ui/badge";
import { createClient } from "@/lib/supabase/client";

function NavLink({
  href,
  active,
  label,
  description,
  icon: Icon,
  onAction,
}: {
  href: string;
  active: boolean;
  label: string;
  description?: string;
  icon: React.ComponentType<{ className?: string }>;
  onAction?: () => void;
}) {
  const { setOpenMobile, isMobile } = useSidebar();

  if (onAction) {
    return (
      <SidebarMenuButton
        tooltip={label}
        className="min-h-11 md:min-h-10"
        onClick={() => {
          onAction();
          if (isMobile) setOpenMobile(false);
        }}
      >
        <Icon className="h-4 w-4 shrink-0" />
        <div className="min-w-0 flex-1">
          <span className="block truncate text-sm">{label}</span>
          {description && (
            <span className="block truncate text-[10px] text-muted-foreground">{description}</span>
          )}
        </div>
      </SidebarMenuButton>
    );
  }

  return (
    <SidebarMenuButton asChild isActive={active} tooltip={label} className="min-h-11 md:min-h-10">
      <Link
        href={href}
        onClick={() => {
          if (isMobile) setOpenMobile(false);
        }}
      >
        <Icon className="h-4 w-4 shrink-0" />
        <div className="min-w-0 flex-1">
          <span className="block truncate text-sm">{label}</span>
          {description && (
            <span className="block truncate text-[10px] text-muted-foreground">{description}</span>
          )}
        </div>
      </Link>
    </SidebarMenuButton>
  );
}

export function AdminSidebar({ activeProvider }: { activeProvider?: "openrouter" | "vertex" }) {
  const pathname = usePathname();
  const router = useRouter();

  async function signOut() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.replace("/admin/login");
    router.refresh();
  }

  return (
    <Sidebar collapsible="offcanvas" className="border-r border-sidebar-border bg-sidebar text-sidebar-foreground">
      <SidebarHeader className="border-b border-sidebar-border px-4 py-4">
        <Link href="/admin" className="flex items-center gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-violet-600 text-sm font-bold text-white shadow-sm">
            SA
          </div>
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold">Super Admin</p>
            <p className="truncate text-xs text-muted-foreground">Platform control only</p>
          </div>
        </Link>
        {activeProvider && (
          <Badge variant="outline" className="mt-3 w-fit text-[10px] capitalize">
            Walkthrough: {activeProvider === "vertex" ? "Vertex AI" : "OpenRouter"}
          </Badge>
        )}
      </SidebarHeader>

      <SidebarContent className="gap-0 overflow-y-auto">
        {ADMIN_NAV_GROUPS.map((group) => (
          <SidebarGroup key={group.label}>
            <SidebarGroupLabel className="text-[10px] font-semibold uppercase tracking-wider">
              {group.label}
            </SidebarGroupLabel>
            <SidebarMenu>
              {group.items.map((item) => {
                const pathOnly = item.href.split("#")[0];
                const active =
                  !item.action &&
                  (pathname === pathOnly ||
                    (pathOnly !== "/admin" && pathname.startsWith(pathOnly + "/")) ||
                    (item.href.includes("#") && pathname === pathOnly));
                return (
                  <SidebarMenuItem key={item.href}>
                    <NavLink
                      href={item.href}
                      active={active}
                      label={item.label}
                      description={item.description}
                      icon={item.icon}
                      onAction={item.action === "signout" ? signOut : undefined}
                    />
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarGroup>
        ))}
      </SidebarContent>

      <SidebarFooter className="border-t border-sidebar-border px-4 py-3">
        <p className="text-[10px] text-muted-foreground">Isolated from user dashboard · /admin only</p>
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  );
}
