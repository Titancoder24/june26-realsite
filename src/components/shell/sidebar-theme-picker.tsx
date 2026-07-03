"use client";

import { Moon, Sun } from "lucide-react";
import { SIDEBAR_THEMES, type SidebarMode, type SidebarThemeId } from "@/lib/theme/sidebar-themes";
import { cn } from "@/lib/utils";

export function SidebarThemePicker({
  value,
  mode,
  onChange,
  onModeChange,
}: {
  value: SidebarThemeId;
  mode: SidebarMode;
  onChange: (id: SidebarThemeId) => void;
  onModeChange: (mode: SidebarMode) => void;
}) {
  return (
    <div className="sidebar-theme-widget flex flex-col items-center gap-2 px-2 py-2">
      <div
        className="sidebar-theme-mode-toggle flex rounded-xl bg-zinc-950 p-1 shadow-[0_1px_2px_rgb(0_0_0/0.18)]"
        role="group"
        aria-label="Appearance mode"
      >
        <button
          type="button"
          className={cn(
            "flex h-7 w-7 items-center justify-center rounded-lg text-white/55 transition-colors",
            mode === "light" && "bg-white text-zinc-950 shadow-sm",
          )}
          onClick={() => onModeChange("light")}
          aria-label="Light mode"
          aria-pressed={mode === "light"}
        >
          <Sun className="h-3 w-3" strokeWidth={1.75} />
        </button>
        <button
          type="button"
          className={cn(
            "flex h-7 w-7 items-center justify-center rounded-lg text-white/55 transition-colors",
            mode === "dark" && "bg-white text-zinc-950 shadow-sm",
          )}
          onClick={() => onModeChange("dark")}
          aria-label="Dark mode"
          aria-pressed={mode === "dark"}
        >
          <Moon className="h-3 w-3" strokeWidth={1.75} />
        </button>
      </div>

      <div className="sidebar-theme-accent-picker flex items-center justify-center gap-1 rounded-full bg-zinc-950 px-2 py-1.5 shadow-[0_1px_2px_rgb(0_0_0/0.18)]" role="listbox" aria-label="Accent color">
        {SIDEBAR_THEMES.map((t) => (
          <button
            key={t.id}
            type="button"
            role="option"
            aria-selected={value === t.id}
            title={t.label}
            aria-label={`${t.label} accent`}
            onClick={() => onChange(t.id)}
            className={cn(
              "h-3.5 w-3.5 shrink-0 rounded-full transition-all duration-150",
              value === t.id
                ? "ring-[1.5px] ring-white ring-offset-[1.5px] ring-offset-zinc-950"
                : "opacity-75 hover:opacity-100",
            )}
            style={{ backgroundColor: "#0f172a" }}
          />
        ))}
      </div>
    </div>
  );
}
