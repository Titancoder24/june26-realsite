"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { useIsMobile } from "@/hooks/use-mobile";

const STORAGE_KEY = "realsite-sidebar-expanded";

export const SIDEBAR_WIDTH_RAIL = "7.5rem";
export const SIDEBAR_WIDTH_EXPANDED = "15.5rem";

type SidebarExpandContextValue = {
  expanded: boolean;
  setExpanded: (value: boolean) => void;
  toggle: () => void;
  ready: boolean;
  isMobile: boolean;
  sidebarWidth: string;
  layout: "rail" | "expanded";
};

const SidebarExpandContext = createContext<SidebarExpandContextValue | null>(null);

function useSidebarExpandState(): SidebarExpandContextValue {
  const isMobile = useIsMobile();
  const [expanded, setExpandedState] = useState(false);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored === "true" || stored === "false") {
      setExpandedState(stored === "true");
    } else {
      setExpandedState(false);
    }
    setReady(true);
  }, []);

  const setExpanded = useCallback((value: boolean) => {
    setExpandedState(value);
    localStorage.setItem(STORAGE_KEY, String(value));
  }, []);

  const toggle = useCallback(() => {
    setExpandedState((prev) => {
      const next = !prev;
      localStorage.setItem(STORAGE_KEY, String(next));
      return next;
    });
  }, []);

  const desktopExpanded = expanded && !isMobile;

  return useMemo(
    () => ({
      expanded: desktopExpanded,
      setExpanded,
      toggle,
      ready,
      isMobile,
      sidebarWidth: desktopExpanded ? SIDEBAR_WIDTH_EXPANDED : SIDEBAR_WIDTH_RAIL,
      layout: desktopExpanded ? "expanded" as const : "rail" as const,
    }),
    [desktopExpanded, setExpanded, toggle, ready, isMobile],
  );
}

export function SidebarExpandProvider({ children }: { children: ReactNode }) {
  const value = useSidebarExpandState();
  return <SidebarExpandContext.Provider value={value}>{children}</SidebarExpandContext.Provider>;
}

export function useSidebarExpand() {
  const ctx = useContext(SidebarExpandContext);
  if (!ctx) {
    throw new Error("useSidebarExpand must be used within SidebarExpandProvider");
  }
  return ctx;
}
