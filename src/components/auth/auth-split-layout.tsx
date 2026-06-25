import Link from "next/link";
import type { ReactNode } from "react";
import { AuthVisualMedia } from "@/components/auth/auth-visual-media";

function RealSiteMark() {
  return (
    <Link href="/" className="flex items-center gap-2.5">
      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-violet-500/15 bg-gradient-to-b from-violet-500 to-violet-600 text-xs font-bold text-white shadow-[0_1px_0_rgba(255,255,255,0.18)_inset,0_3px_10px_rgba(139,92,246,0.22)]">
        RS
      </div>
      <span className="text-base font-semibold tracking-tight">RealSite</span>
    </Link>
  );
}

function AuthVisualPanel({ className }: { className?: string }) {
  return <AuthVisualMedia className={className} />;
}

export function AuthSplitLayout({
  children,
  headerAside,
}: {
  children: ReactNode;
  headerAside: ReactNode;
}) {
  return (
    <div
      className="min-h-svh min-w-0 overflow-x-hidden bg-slate-100/70"
      style={{
        paddingTop: "max(0.75rem, env(safe-area-inset-top))",
        paddingBottom: "max(0.75rem, env(safe-area-inset-bottom))",
      }}
    >
      <div className="mx-auto flex min-h-[calc(100svh-max(0.75rem,env(safe-area-inset-top))-max(0.75rem,env(safe-area-inset-bottom)))] max-w-[1280px] flex-col p-3 sm:p-4 lg:p-6">
        <div className="auth-premium-card grid min-h-0 flex-1 overflow-hidden rounded-[1.25rem] bg-background lg:min-h-[min(100%,640px)] lg:grid-cols-[1.05fr_1fr]">
          <AuthVisualPanel className="auth-visual-panel relative h-52 shrink-0 overflow-hidden sm:h-60 lg:hidden" />

          <div className="auth-visual-rail relative hidden min-h-full overflow-hidden lg:block lg:min-h-0">
            <AuthVisualPanel className="auth-visual-panel h-full min-h-full w-full" />
          </div>

          <div className="auth-form-surface flex min-h-0 flex-1 flex-col lg:min-h-full">
            <header className="flex items-center justify-between gap-4 border-b border-border/40 px-5 py-4 sm:px-8 sm:py-5">
              <RealSiteMark />
              {headerAside}
            </header>

            <div className="flex flex-1 items-center justify-center px-5 py-8 sm:px-8">
              {children}
            </div>

            <footer className="flex items-center justify-between gap-4 border-t border-border/40 px-5 py-4 text-xs text-muted-foreground sm:px-8">
              <span>© {new Date().getFullYear()} RealSite</span>
              <span className="inline-flex items-center gap-1.5">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" aria-hidden="true" />
                All systems operational
              </span>
            </footer>
          </div>
        </div>
      </div>
    </div>
  );
}
