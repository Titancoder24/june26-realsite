export type SidebarThemeId = "blue" | "emerald" | "rose" | "amber" | "violet";
export type SidebarMode = "light" | "dark";

export interface SidebarTheme {
  id: SidebarThemeId;
  label: string;
  swatch: string;
  accent: {
    primary: string;
    primaryHover: string;
    primaryActive: string;
    primaryFg: string;
    chart1: string;
    chart2: string;
    chart3: string;
    chart4: string;
    chart5: string;
    ring: string;
  };
  surfaces: Record<SidebarMode, {
    sidebar: string;
    sidebarBorder: string;
    sidebarAccent: string;
    sidebarAccentFg: string;
    sidebarPrimary: string;
    sidebarPrimaryFg: string;
  }>;
}

/** Neutral dashboard canvas — 95% of UI stays here. Never themed. */
export const STABLE_SURFACE_TOKENS = {
  background: "#f4f5f7",
  foreground: "#09090b",
  card: "#ffffff",
  cardForeground: "#09090b",
  muted: "#f3f4f6",
  mutedForeground: "#52525b",
  secondary: "#f3f4f6",
  secondaryForeground: "#3f3f46",
  border: "#e5e7eb",
  input: "#e5e7eb",
  sidebarNavFg: "#ffffff",
} as const;

/** Enterprise palettes — saturated sidebar identity, color only on interactive surfaces. */
export const SIDEBAR_THEMES: SidebarTheme[] = [
  {
    id: "emerald",
    label: "Emerald",
    swatch: "#10B981",
    accent: {
      primary: "#10B981",
      primaryHover: "#059669",
      primaryActive: "#047857",
      primaryFg: "#ffffff",
      chart1: "#10B981",
      chart2: "#34D399",
      chart3: "#6EE7B7",
      chart4: "#A7F3D0",
      chart5: "#D1FAE5",
      ring: "#10B981",
    },
    surfaces: {
      light: {
        sidebar: "#047857",
        sidebarBorder: "rgba(255,255,255,0.14)",
        sidebarAccent: "rgba(255,255,255,0.1)",
        sidebarAccentFg: "#ffffff",
        sidebarPrimary: "#10B981",
        sidebarPrimaryFg: "#ffffff",
      },
      dark: {
        sidebar: "#065F46",
        sidebarBorder: "rgba(255,255,255,0.12)",
        sidebarAccent: "rgba(255,255,255,0.08)",
        sidebarAccentFg: "#ffffff",
        sidebarPrimary: "#10B981",
        sidebarPrimaryFg: "#ffffff",
      },
    },
  },
  {
    id: "blue",
    label: "Blue",
    swatch: "#2563EB",
    accent: {
      primary: "#2563EB",
      primaryHover: "#1D4ED8",
      primaryActive: "#1E40AF",
      primaryFg: "#ffffff",
      chart1: "#2563EB",
      chart2: "#3B82F6",
      chart3: "#60A5FA",
      chart4: "#93C5FD",
      chart5: "#DBEAFE",
      ring: "#2563EB",
    },
    surfaces: {
      light: {
        sidebar: "#1E40AF",
        sidebarBorder: "rgba(255,255,255,0.14)",
        sidebarAccent: "rgba(255,255,255,0.1)",
        sidebarAccentFg: "#ffffff",
        sidebarPrimary: "#2563EB",
        sidebarPrimaryFg: "#ffffff",
      },
      dark: {
        sidebar: "#1E3A8A",
        sidebarBorder: "rgba(255,255,255,0.12)",
        sidebarAccent: "rgba(255,255,255,0.08)",
        sidebarAccentFg: "#ffffff",
        sidebarPrimary: "#2563EB",
        sidebarPrimaryFg: "#ffffff",
      },
    },
  },
  {
    id: "violet",
    label: "Purple",
    swatch: "#7C3AED",
    accent: {
      primary: "#7C3AED",
      primaryHover: "#6D28D9",
      primaryActive: "#5B21B6",
      primaryFg: "#ffffff",
      chart1: "#7C3AED",
      chart2: "#8B5CF6",
      chart3: "#A78BFA",
      chart4: "#C4B5FD",
      chart5: "#EDE9FE",
      ring: "#7C3AED",
    },
    surfaces: {
      light: {
        sidebar: "#5B21B6",
        sidebarBorder: "rgba(255,255,255,0.14)",
        sidebarAccent: "rgba(255,255,255,0.1)",
        sidebarAccentFg: "#ffffff",
        sidebarPrimary: "#7C3AED",
        sidebarPrimaryFg: "#ffffff",
      },
      dark: {
        sidebar: "#4C1D95",
        sidebarBorder: "rgba(255,255,255,0.12)",
        sidebarAccent: "rgba(255,255,255,0.08)",
        sidebarAccentFg: "#ffffff",
        sidebarPrimary: "#7C3AED",
        sidebarPrimaryFg: "#ffffff",
      },
    },
  },
  {
    id: "amber",
    label: "Orange",
    swatch: "#F97316",
    accent: {
      primary: "#F97316",
      primaryHover: "#EA580C",
      primaryActive: "#C2410C",
      primaryFg: "#ffffff",
      chart1: "#F97316",
      chart2: "#FB923C",
      chart3: "#FDBA74",
      chart4: "#FED7AA",
      chart5: "#FFEDD5",
      ring: "#F97316",
    },
    surfaces: {
      light: {
        sidebar: "#C2410C",
        sidebarBorder: "rgba(255,255,255,0.14)",
        sidebarAccent: "rgba(255,255,255,0.1)",
        sidebarAccentFg: "#ffffff",
        sidebarPrimary: "#F97316",
        sidebarPrimaryFg: "#ffffff",
      },
      dark: {
        sidebar: "#9A3412",
        sidebarBorder: "rgba(255,255,255,0.12)",
        sidebarAccent: "rgba(255,255,255,0.08)",
        sidebarAccentFg: "#ffffff",
        sidebarPrimary: "#F97316",
        sidebarPrimaryFg: "#ffffff",
      },
    },
  },
  {
    id: "rose",
    label: "Rose",
    swatch: "#E11D48",
    accent: {
      primary: "#E11D48",
      primaryHover: "#BE123C",
      primaryActive: "#9F1239",
      primaryFg: "#ffffff",
      chart1: "#E11D48",
      chart2: "#F43F5E",
      chart3: "#FB7185",
      chart4: "#FDA4AF",
      chart5: "#FFE4E6",
      ring: "#E11D48",
    },
    surfaces: {
      light: {
        sidebar: "#9F1239",
        sidebarBorder: "rgba(255,255,255,0.14)",
        sidebarAccent: "rgba(255,255,255,0.1)",
        sidebarAccentFg: "#ffffff",
        sidebarPrimary: "#E11D48",
        sidebarPrimaryFg: "#ffffff",
      },
      dark: {
        sidebar: "#881337",
        sidebarBorder: "rgba(255,255,255,0.12)",
        sidebarAccent: "rgba(255,255,255,0.08)",
        sidebarAccentFg: "#ffffff",
        sidebarPrimary: "#E11D48",
        sidebarPrimaryFg: "#ffffff",
      },
    },
  },
];

export const DEFAULT_THEME_ID: SidebarThemeId = "emerald";
export const DEFAULT_MODE: SidebarMode = "light";

export function getSidebarTheme(id: SidebarThemeId) {
  return SIDEBAR_THEMES.find((t) => t.id === id) ?? SIDEBAR_THEMES[0];
}

export function themeStyleVars(id: SidebarThemeId, mode: SidebarMode): Record<string, string> {
  const theme = getSidebarTheme(id);
  const surface = theme.surfaces[mode];
  const accent = theme.accent;
  const stable = STABLE_SURFACE_TOKENS;

  return {
    "--primary": accent.primary,
    "--primary-hover": accent.primaryHover,
    "--primary-active": accent.primaryActive,
    "--primary-foreground": accent.primaryFg,
    "--ring": accent.ring,
    "--chart-1": accent.chart1,
    "--chart-2": accent.chart2,
    "--chart-3": accent.chart3,
    "--chart-4": accent.chart4,
    "--chart-5": accent.chart5,
    "--sidebar-header": surface.sidebar,
    "--sidebar": surface.sidebar,
    "--sidebar-foreground": stable.sidebarNavFg,
    "--sidebar-border": surface.sidebarBorder,
    "--sidebar-accent": surface.sidebarAccent,
    "--sidebar-accent-foreground": surface.sidebarAccentFg,
    "--sidebar-primary": surface.sidebarPrimary,
    "--sidebar-primary-foreground": surface.sidebarPrimaryFg,
    "--sidebar-ring": accent.ring,
    "--sidebar-hover": surface.sidebarAccent,
    "--sidebar-active": surface.sidebarPrimary,
    "--sidebar-active-glow": `color-mix(in srgb, ${surface.sidebarPrimary} 40%, transparent)`,
    "--pulse-accent": accent.primary,
    "--pulse-accent-soft": `color-mix(in srgb, ${accent.primary} 12%, transparent)`,
  };
}

const THEME_VAR_KEYS = Object.keys(themeStyleVars(DEFAULT_THEME_ID, DEFAULT_MODE));

export function applyThemeToDocument(id: SidebarThemeId, mode: SidebarMode) {
  const root = document.documentElement;
  const vars = themeStyleVars(id, mode);
  for (const [key, value] of Object.entries(vars)) {
    root.style.setProperty(key, value);
  }
  root.dataset.theme = id;
  root.dataset.themeMode = mode;
}

export function clearThemeFromDocument() {
  const root = document.documentElement;
  for (const key of THEME_VAR_KEYS) {
    root.style.removeProperty(key);
  }
  delete root.dataset.theme;
  delete root.dataset.themeMode;
}
