import type { UserRole } from "@/types/domain";

const ROLE_HIERARCHY: Record<UserRole, number> = {
  viewer: 1,
  sales_agent: 2,
  marketing_manager: 3,
  sales_manager: 4,
  project_manager: 5,
  organization_admin: 6,
  platform_admin: 7,
};

export function hasRole(userRole: UserRole, required: UserRole): boolean {
  return ROLE_HIERARCHY[userRole] >= ROLE_HIERARCHY[required];
}

export function canAccessAdmin(role: UserRole): boolean {
  return role === "platform_admin";
}

export function canManageProjects(role: UserRole): boolean {
  return hasRole(role, "project_manager");
}

export function canViewLeads(role: UserRole): boolean {
  return hasRole(role, "sales_agent");
}

export function canManageLeads(role: UserRole): boolean {
  return hasRole(role, "sales_manager");
}

export const ROUTE_PERMISSIONS: Record<string, UserRole> = {
  "/dashboard": "viewer",
  "/dashboard/walkthrough-dashboard": "marketing_manager",
  "/dashboard/analytics": "marketing_manager",
  "/dashboard/projects": "project_manager",
  "/dashboard/properties": "project_manager",
  "/dashboard/experiences": "project_manager",
  "/dashboard/capture": "project_manager",
  "/dashboard/floor-maps": "project_manager",
  "/dashboard/checkpoints": "project_manager",
  "/dashboard/knowledge": "project_manager",
  "/dashboard/ai-agent": "project_manager",
  "/dashboard/leads": "sales_agent",
  "/dashboard/site-visits": "sales_agent",
  "/dashboard/inventory": "sales_agent",
  "/dashboard/campaigns": "marketing_manager",
  "/dashboard/settings": "viewer",
  "/dashboard/team": "organization_admin",
  "/admin": "platform_admin",
  "/admin/image-walkthrough": "platform_admin",
};

export function getRouteMinRole(path: string): UserRole | null {
  const match = Object.entries(ROUTE_PERMISSIONS)
    .sort((a, b) => b[0].length - a[0].length)
    .find(([route]) => path === route || path.startsWith(route + "/"));
  return match?.[1] ?? null;
}
