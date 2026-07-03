import type { LucideIcon } from "lucide-react";
import {
  BarChart3,
  Building,
  Building2,
  Camera,
  Clapperboard,
  Compass,
  FileStack,
  LayoutDashboard,
  MapPinned,
  Megaphone,
  MessageCircle,
  Mic2,
  Package,
  Settings2,
  GraduationCap,
  UserRoundSearch,
  Users2,
  Video,
  BookOpen,
  FileBarChart2,
  UploadCloud,
} from "lucide-react";
import type { UserRole } from "@/types/domain";
import { canAccessRoute } from "@/components/auth/role-guard";

export type NavItem = {
  href: string;
  label: string;
  shortLabel?: string;
  icon: LucideIcon;
  minRole?: UserRole;
  adminOnly?: boolean;
  mobileTab?: boolean;
};

export type NavGroup = {
  label: string;
  items: NavItem[];
};

export const DASHBOARD_NAV_GROUPS: NavGroup[] = [
  {
    label: "Command Center",
    items: [
      { href: "/dashboard", label: "Portfolio Pulse", shortLabel: "Pulse", icon: LayoutDashboard, mobileTab: true },
      { href: "/dashboard/walkthrough-dashboard", label: "Walkthrough Dashboard", shortLabel: "Walkthrough", icon: Clapperboard, minRole: "marketing_manager" },
      { href: "/dashboard/analytics", label: "Buyer Analytics", shortLabel: "Analytics", icon: BarChart3 },
    ],
  },
  {
    label: "Property Portfolio",
    items: [
      { href: "/dashboard/projects", label: "Developments", shortLabel: "Projects", icon: Building2, minRole: "project_manager" },
      { href: "/dashboard/experiences/new", label: "360° Capture", shortLabel: "Capture", icon: Camera, minRole: "project_manager" },
      { href: "/dashboard/properties", label: "Listings", shortLabel: "Listings", icon: Building, minRole: "project_manager", mobileTab: true },
      { href: "/dashboard/experiences", label: "Virtual Tours", shortLabel: "Tours", icon: Compass, minRole: "project_manager" },
      { href: "/dashboard/floor-maps", label: "Floor Plans", shortLabel: "Floors", icon: MapPinned, minRole: "project_manager" },
      { href: "/dashboard/inventory", label: "Unit Inventory", shortLabel: "Units", icon: Package, minRole: "sales_agent" },
    ],
  },
  {
    label: "Sales & AI",
    items: [
      { href: "/dashboard/knowledge", label: "Property Intel", shortLabel: "Intel", icon: FileStack, minRole: "project_manager" },
      { href: "/dashboard/ai-agent", label: "Voice Concierge", shortLabel: "Voice", icon: Mic2, minRole: "project_manager" },
      { href: "/dashboard/sales-training", label: "Sales Training", shortLabel: "Training", icon: GraduationCap, minRole: "sales_agent" },
      { href: "/dashboard/sales-training/chat", label: "Chat", shortLabel: "Chat", icon: MessageCircle, minRole: "sales_agent" },
      { href: "/dashboard/leads", label: "Lead Pipeline", shortLabel: "Leads", icon: UserRoundSearch, minRole: "sales_agent", mobileTab: true },
      { href: "/dashboard/site-visits", label: "Site Visits", shortLabel: "Visits", icon: Video, minRole: "sales_agent" },
      { href: "/dashboard/campaigns", label: "Campaign Hub", shortLabel: "Campaigns", icon: Megaphone, minRole: "marketing_manager" },
    ],
  },
  {
    label: "Brochure Intelligence",
    items: [
      { href: "/dashboard/brochures/reports", label: "Brochure Reports", shortLabel: "Reports", icon: FileBarChart2, minRole: "sales_agent", mobileTab: true },
      { href: "/dashboard/brochures/new", label: "Upload Brochure", shortLabel: "Upload", icon: UploadCloud, minRole: "sales_agent" },
      { href: "/dashboard/brochures", label: "Brochure Builder", shortLabel: "Builder", icon: BookOpen, minRole: "sales_agent" },
    ],
  },
  {
    label: "Workspace",
    items: [
      { href: "/dashboard/team", label: "Team Access", shortLabel: "Team", icon: Users2, minRole: "organization_admin" },
      { href: "/dashboard/settings", label: "Workspace", shortLabel: "Settings", icon: Settings2 },
    ],
  },
];

export function getVisibleNavGroups(role: UserRole) {
  return DASHBOARD_NAV_GROUPS.map((group) => ({
    ...group,
    items: group.items.filter((item) => {
      if (item.adminOnly) return false;
      return canAccessRoute(role, item.href);
    }),
  })).filter((g) => g.items.length > 0);
}

export function getMobileTabItems(role: UserRole) {
  const items: NavItem[] = [];
  for (const group of DASHBOARD_NAV_GROUPS) {
    for (const item of group.items) {
      if (item.mobileTab && canAccessRoute(role, item.href) && !item.adminOnly) {
        items.push(item);
      }
    }
  }
  return items.slice(0, 4);
}
