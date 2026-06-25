"use client";

import { useCallback, useEffect, useState } from "react";
import {
  DEFAULT_MODE,
  DEFAULT_THEME_ID,
  type SidebarMode,
  type SidebarThemeId,
  getSidebarTheme,
} from "@/lib/theme/sidebar-themes";

const THEME_KEY = "realsite-accent-theme";
const MODE_KEY = "realsite-sidebar-mode";

/** Standalone hook — prefer `useAppTheme()` inside the dashboard shell. */
export function useSidebarTheme() {
  const [themeId, setThemeIdState] = useState<SidebarThemeId>(DEFAULT_THEME_ID);
  const [mode, setModeState] = useState<SidebarMode>(DEFAULT_MODE);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const storedTheme = localStorage.getItem(THEME_KEY) as SidebarThemeId | null;
    const storedMode = localStorage.getItem(MODE_KEY) as SidebarMode | null;
    if (storedTheme && getSidebarTheme(storedTheme)) setThemeIdState(storedTheme);
    if (storedMode === "light" || storedMode === "dark") setModeState(storedMode);
    setReady(true);
  }, []);

  const setThemeId = useCallback((id: SidebarThemeId) => {
    setThemeIdState(id);
    localStorage.setItem(THEME_KEY, id);
  }, []);

  const setMode = useCallback((m: SidebarMode) => {
    setModeState(m);
    localStorage.setItem(MODE_KEY, m);
    document.documentElement.classList.remove("light", "dark");
    document.documentElement.classList.add(m);
    document.documentElement.style.colorScheme = m;
  }, []);

  return { themeId, setThemeId, mode, setMode, theme: getSidebarTheme(themeId), ready };
}
