"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import {
  DEFAULT_MODE,
  DEFAULT_THEME_ID,
  applyThemeToDocument,
  clearThemeFromDocument,
  type SidebarMode,
  type SidebarTheme,
  type SidebarThemeId,
  getSidebarTheme,
  themeStyleVars,
} from "@/lib/theme/sidebar-themes";

const THEME_KEY = "realsite-accent-theme";
const MODE_KEY = "realsite-sidebar-mode";

type AppThemeContextValue = {
  themeId: SidebarThemeId;
  setThemeId: (id: SidebarThemeId) => void;
  mode: SidebarMode;
  setMode: (mode: SidebarMode) => void;
  toggleMode: () => void;
  theme: SidebarTheme;
  ready: boolean;
  styleVars: Record<string, string> | undefined;
};

const AppThemeContext = createContext<AppThemeContextValue | null>(null);

function applyDocumentMode(mode: SidebarMode) {
  const root = document.documentElement;
  root.classList.add("theme-switching");
  root.classList.remove("light", "dark");
  root.classList.add(mode);
  root.style.colorScheme = mode;
  window.setTimeout(() => root.classList.remove("theme-switching"), 320);
}

export function AppThemeProvider({ children }: { children: React.ReactNode }) {
  const [themeId, setThemeIdState] = useState<SidebarThemeId>(DEFAULT_THEME_ID);
  const [mode, setModeState] = useState<SidebarMode>(DEFAULT_MODE);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const storedTheme = localStorage.getItem(THEME_KEY) as SidebarThemeId | null;
    const storedMode = localStorage.getItem(MODE_KEY) as SidebarMode | null;
    if (storedTheme && getSidebarTheme(storedTheme)) {
      setThemeIdState(storedTheme);
    } else {
      setThemeIdState(DEFAULT_THEME_ID);
    }
    const resolvedMode = storedMode === "light" || storedMode === "dark" ? storedMode : DEFAULT_MODE;
    setModeState(resolvedMode);
    applyDocumentMode(resolvedMode);
    setReady(true);
  }, []);

  useEffect(() => {
    if (!ready) return;
    applyThemeToDocument(themeId, mode);
    return () => clearThemeFromDocument();
  }, [themeId, mode, ready]);

  const setThemeId = useCallback((id: SidebarThemeId) => {
    setThemeIdState(id);
    localStorage.setItem(THEME_KEY, id);
  }, []);

  const setMode = useCallback((next: SidebarMode) => {
    setModeState(next);
    localStorage.setItem(MODE_KEY, next);
    applyDocumentMode(next);
  }, []);

  const toggleMode = useCallback(() => {
    setMode(mode === "dark" ? "light" : "dark");
  }, [mode, setMode]);

  const value = useMemo<AppThemeContextValue>(
    () => ({
      themeId,
      setThemeId,
      mode,
      setMode,
      toggleMode,
      theme: getSidebarTheme(themeId),
      ready,
      styleVars: ready ? themeStyleVars(themeId, mode) : undefined,
    }),
    [themeId, setThemeId, mode, setMode, toggleMode, ready],
  );

  return <AppThemeContext.Provider value={value}>{children}</AppThemeContext.Provider>;
}

export function useAppTheme() {
  const ctx = useContext(AppThemeContext);
  if (!ctx) {
    throw new Error("useAppTheme must be used within AppThemeProvider");
  }
  return ctx;
}

/** Back-compat alias used by sidebar components. */
export function useSidebarThemeFromContext() {
  return useAppTheme();
}
