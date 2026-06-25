"use client";

import { useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { AuthSplitLayout } from "@/components/auth/auth-split-layout";
import { Loader2, ArrowRight, Mail, Lock, User, Building2 } from "lucide-react";

export default function SignupPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [orgName, setOrgName] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSignup(e: React.FormEvent) {
    e.preventDefault();
    if (loading) return;
    setError("");
    setLoading(true);

    try {
      const res = await fetch("/api/auth/signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: email.trim(),
          password,
          fullName,
          organizationName: orgName,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Signup failed");
        setLoading(false);
        return;
      }

      const loginRes = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim(), password }),
        credentials: "same-origin",
      });
      const loginData = await loginRes.json().catch(() => ({}));
      if (!loginRes.ok) {
        setError(typeof loginData?.error === "string" ? loginData.error : "Account created but sign-in failed");
        setLoading(false);
        return;
      }

      window.location.assign("/dashboard");
    } catch {
      setError("Network error. Check your connection and try again.");
      setLoading(false);
    }
  }

  return (
    <AuthSplitLayout
      headerAside={
        <p className="text-sm text-muted-foreground">
          Have an account?{" "}
          <Link href="/login" className="font-medium text-foreground underline-offset-4 hover:underline">
            Sign in
          </Link>
        </p>
      }
    >
      <div className="w-full max-w-[420px]">
        <div className="space-y-2 text-center lg:text-left">
          <h1 className="section-title">Create account</h1>
          <p className="text-[0.9375rem] leading-relaxed text-muted-foreground">
            Set up your organization and start building property experiences.
          </p>
        </div>

        <form onSubmit={handleSignup} className="mt-8 space-y-4">
          <div className="space-y-2">
            <label htmlFor="signup-name" className="text-sm font-medium tracking-wide text-foreground/90">
              Full name
            </label>
            <div className="relative">
              <User className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                id="signup-name"
                placeholder="Your name"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                disabled={loading}
                required
                className="h-11 bg-muted/30 pl-10 text-base"
              />
            </div>
          </div>

          <div className="space-y-2">
            <label htmlFor="signup-org" className="text-sm font-medium tracking-wide text-foreground/90">
              Organization
            </label>
            <div className="relative">
              <Building2 className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                id="signup-org"
                placeholder="Company or developer name"
                value={orgName}
                onChange={(e) => setOrgName(e.target.value)}
                disabled={loading}
                required
                className="h-11 bg-muted/30 pl-10 text-base"
              />
            </div>
          </div>

          <div className="space-y-2">
            <label htmlFor="signup-email" className="text-sm font-medium tracking-wide text-foreground/90">
              Work email
            </label>
            <div className="relative">
              <Mail className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                id="signup-email"
                type="email"
                inputMode="email"
                autoComplete="email"
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
            <label htmlFor="signup-password" className="text-sm font-medium tracking-wide text-foreground/90">
              Password
            </label>
            <div className="relative">
              <Lock className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                id="signup-password"
                type="password"
                autoComplete="new-password"
                placeholder="At least 6 characters"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                disabled={loading}
                required
                minLength={6}
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
                Creating account…
              </>
            ) : (
              <>
                Create account
                <ArrowRight className="h-4 w-4" />
              </>
            )}
          </Button>
        </form>
      </div>
    </AuthSplitLayout>
  );
}
