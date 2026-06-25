"use client";

import { useState, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { AuthSplitLayout } from "@/components/auth/auth-split-layout";
import { Loader2, ArrowRight, Mail, Lock } from "lucide-react";

function LoginForm() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const params = useSearchParams();
  const redirect = params.get("redirect") ?? "/dashboard";

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    if (loading) return;

    setLoading(true);
    setError("");

    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 30000);

      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim(), password }),
        credentials: "same-origin",
        signal: controller.signal,
      });

      clearTimeout(timeout);
      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        setError(typeof data?.error === "string" ? data.error : "Sign in failed");
        setLoading(false);
        return;
      }

      window.location.assign(redirect);
    } catch (err) {
      if (err instanceof Error && err.name === "AbortError") {
        setError("Request timed out. Check your connection and try again.");
      } else {
        setError("Network error. Check your connection and try again.");
      }
      setLoading(false);
    }
  }

  return (
    <div className="w-full max-w-[420px]">
      <div className="space-y-2 text-center lg:text-left">
        <h1 className="section-title">Welcome back</h1>
        <p className="text-[0.9375rem] leading-relaxed text-muted-foreground">
          Sign in to continue to your workspace.
        </p>
      </div>

      <form onSubmit={handleLogin} className="mt-8 space-y-5">
        <div className="space-y-2">
          <label htmlFor="login-email" className="text-sm font-medium tracking-wide text-foreground/90">
            Email
          </label>
          <div className="relative">
            <Mail className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              id="login-email"
              type="email"
              inputMode="email"
              autoComplete="email"
              autoCapitalize="none"
              autoCorrect="off"
              placeholder="you@company.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              disabled={loading}
              required
              className="h-11 bg-muted/30 pl-10 text-base"
            />
          </div>
        </div>

        <div className="space-y-2">
          <label htmlFor="login-password" className="text-sm font-medium tracking-wide text-foreground/90">
            Password
          </label>
          <div className="relative">
            <Lock className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              id="login-password"
              type="password"
              autoComplete="current-password"
              placeholder="Enter your password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              disabled={loading}
              required
              className="h-11 bg-muted/30 pl-10 text-base"
            />
          </div>
        </div>

        {error && <p className="text-sm text-destructive">{error}</p>}

        <Button
          type="submit"
          variant="premium"
          size="lg"
          className="mt-2 h-11 w-full rounded-xl text-base"
          disabled={loading}
        >
          {loading ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Signing in…
            </>
          ) : (
            <>
              Sign in
              <ArrowRight className="h-4 w-4" />
            </>
          )}
        </Button>
      </form>
    </div>
  );
}

export default function LoginPage() {
  return (
    <AuthSplitLayout
      headerAside={
        <p className="text-sm text-muted-foreground">
          New here?{" "}
          <Link href="/signup" className="font-medium text-foreground underline-offset-4 hover:underline">
            Create account
          </Link>
        </p>
      }
    >
      <Suspense fallback={<div className="text-sm text-muted-foreground">Loading…</div>}>
        <LoginForm />
      </Suspense>
    </AuthSplitLayout>
  );
}
