"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { hasRole, ROUTE_PERMISSIONS } from "@/lib/auth/rbac";
import type { UserRole } from "@/types/domain";

export function useUserRole() {
  const [role, setRole] = useState<UserRole>("viewer");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUser().then(async ({ data: { user } }) => {
      if (!user) { setLoading(false); return; }
      const { data } = await supabase.from("profiles").select("role").eq("id", user.id).single();
      setRole((data?.role as UserRole) ?? "viewer");
      setLoading(false);
    });
  }, []);

  return { role, loading };
}

export function canAccessRoute(role: UserRole, path: string): boolean {
  const match = Object.entries(ROUTE_PERMISSIONS)
    .sort((a, b) => b[0].length - a[0].length)
    .find(([route]) => path === route || path.startsWith(route + "/"));
  if (!match) return true;
  return hasRole(role, match[1]);
}

export function RoleGuard({ children, minRole }: { children: React.ReactNode; minRole?: UserRole }) {
  const { role, loading } = useUserRole();
  if (loading) return <div className="p-6 text-muted-foreground">Loading…</div>;
  if (minRole && !hasRole(role, minRole)) {
    return <div className="p-6 text-destructive">You do not have permission to view this page.</div>;
  }
  return <>{children}</>;
}
