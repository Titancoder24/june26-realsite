"use client";

import { Moon, Sun } from "lucide-react";
import { useAppTheme } from "@/components/shell/app-theme-provider";
import { cn } from "@/lib/utils";

export function AppThemeToggle({ className }: { className?: string }) {
  const { mode, toggleMode, ready } = useAppTheme();
  const isDark = mode === "dark";

  return (
    <button
      type="button"
      onClick={toggleMode}
      disabled={!ready}
      aria-label={isDark ? "Switch to light mode" : "Switch to dark mode"}
      className={cn(
        "group relative inline-flex h-9 w-[4.25rem] shrink-0 items-center rounded-full border p-0.5 transition-all duration-300",
        "border-border/60 bg-muted/60 shadow-sm",
        "hover:border-primary/30 hover:shadow-md",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
        "disabled:opacity-50",
        isDark && "border-primary/20 bg-gradient-to-r from-slate-900 via-slate-800 to-indigo-950 shadow-[0_0_24px_-4px_rgba(99,102,241,0.45)]",
        className,
      )}
    >
      <span
        className={cn(
          "absolute inset-0 rounded-full opacity-0 transition-opacity duration-300",
          isDark && "opacity-100 bg-[radial-gradient(circle_at_30%_50%,rgba(129,140,248,0.18),transparent_55%)]",
        )}
        aria-hidden
      />
      <span
        className={cn(
          "relative z-10 flex h-7 w-7 items-center justify-center rounded-full bg-background text-foreground shadow-md transition-transform duration-300 ease-out",
          isDark ? "translate-x-[2rem]" : "translate-x-0",
        )}
      >
        <Sun
          className={cn(
            "absolute h-3.5 w-3.5 text-amber-500 transition-all duration-300",
            isDark ? "scale-0 rotate-90 opacity-0" : "scale-100 rotate-0 opacity-100",
          )}
        />
        <Moon
          className={cn(
            "absolute h-3.5 w-3.5 text-indigo-300 transition-all duration-300",
            isDark ? "scale-100 rotate-0 opacity-100" : "scale-0 -rotate-90 opacity-0",
          )}
        />
      </span>
      <Sun
        className={cn(
          "pointer-events-none absolute left-2.5 h-3 w-3 text-muted-foreground/50 transition-opacity duration-300",
          isDark ? "opacity-30" : "opacity-0",
        )}
        aria-hidden
      />
      <Moon
        className={cn(
          "pointer-events-none absolute right-2.5 h-3 w-3 text-muted-foreground/50 transition-opacity duration-300",
          isDark ? "opacity-0" : "opacity-30",
        )}
        aria-hidden
      />
    </button>
  );
}
