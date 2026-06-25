import type { LucideIcon } from "lucide-react";
import {
  Clapperboard,
  Cloud,
  FileSearch,
  LayoutDashboard,
  LogOut,
  Map,
  Router,
  Settings2,
  Sparkles,
  Wand2,
} from "lucide-react";

export type AdminNavItem = {
  href: string;
  label: string;
  description?: string;
  icon: LucideIcon;
  action?: "signout";
};

export type AdminNavGroup = {
  label: string;
  items: AdminNavItem[];
};

export const ADMIN_NAV_GROUPS: AdminNavGroup[] = [
  {
    label: "Property Walkthrough",
    items: [
      {
        href: "/admin/image-walkthrough",
        label: "Image Walkthrough",
        description: "Create, review & publish",
        icon: Map,
      },
      {
        href: "/admin/walkthrough-ai",
        label: "AI Provider",
        description: "OpenRouter or Vertex AI",
        icon: Clapperboard,
      },
      {
        href: "/admin/walkthrough-ai#vertex",
        label: "Vertex Credentials",
        description: "API key & project ID",
        icon: Cloud,
      },
      {
        href: "/admin/walkthrough-ai#pipeline",
        label: "Pipeline",
        description: "Planner + Veo motion",
        icon: Wand2,
      },
    ],
  },
  {
    label: "Platform",
    items: [
      { href: "/admin", label: "Analytics", description: "Users, usage & API calls", icon: LayoutDashboard },
      { href: "/admin/worldlabs", label: "World Labs", icon: Sparkles },
      { href: "/admin/engines", label: "Engine Control", icon: Router },
      { href: "/admin/models", label: "Models & Voice", icon: Settings2 },
      { href: "/admin/audit", label: "Audit Logs", icon: FileSearch },
    ],
  },
  {
    label: "Session",
    items: [
      { href: "#signout", label: "Sign out", icon: LogOut, action: "signout" },
    ],
  },
];
