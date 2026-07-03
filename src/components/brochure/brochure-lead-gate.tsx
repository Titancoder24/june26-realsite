"use client";

import Link from "next/link";
import type { CSSProperties } from "react";
import { ArrowRight, BookOpen, Check, ShieldCheck } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { BrochureConsentNotice } from "@/components/brochure/brochure-consent-notice";
import type { BrochureLeadGateSettings } from "@/types/brochure-intelligence";

export function BrochureLeadGate({
  title,
  slug,
  fileUrl,
  pageCount,
  viewerMode,
  settings,
  onSubmit,
  loading,
  error,
}: {
  title: string;
  slug: string;
  fileUrl: string;
  pageCount: number;
  viewerMode: string;
  settings?: BrochureLeadGateSettings;
  onSubmit: (data: { name: string; phone: string; email?: string; consent: boolean }) => void;
  loading?: boolean;
  error?: string | null;
}) {
  const gate = {
    brandName: settings?.brandName?.trim() || "Smart brochure",
    logoUrl: settings?.logoUrl?.trim(),
    eyebrow: settings?.eyebrow?.trim() || "View brochure",
    headline: settings?.headline?.trim() || "Your details",
    subheadline: settings?.subheadline?.trim() || "This takes less than 10 seconds.",
    helperText:
      settings?.helperText?.trim() ||
      `Enter your details once and open the full brochure in a clean ${
        viewerMode === "flipbook" ? "flipbook" : "PDF"
      } experience.`,
    buttonLabel: settings?.buttonLabel?.trim() || "View Brochure",
    primaryColor: settings?.primaryColor || "#10b981",
    accentColor: settings?.accentColor || "#0f172a",
    theme: settings?.theme || "glass",
    layout: settings?.layout || "split",
  };

  return (
    <main
      className={`bi-public-gate bi-public-theme-${gate.theme} bi-public-layout-${gate.layout}`}
      style={
        {
          "--bi-public-primary": gate.primaryColor,
          "--bi-public-accent": gate.accentColor,
        } as CSSProperties
      }
    >
      <div className="bi-public-pdf-backdrop" aria-hidden="true">
        {fileUrl ? <iframe src={`${fileUrl}#toolbar=0&navpanes=0&scrollbar=0`} title="" /> : null}
      </div>

      <section className="bi-public-gate-grid">
        <div className="bi-public-copy">
          <div className="bi-public-badge">
            {gate.logoUrl ? (
              <img src={gate.logoUrl} alt="" className="bi-public-logo-mini" />
            ) : (
              <BookOpen className="h-4 w-4" />
            )}
            {gate.brandName}
          </div>
          <h1>{title}</h1>
          <p>{gate.helperText}</p>
          <div className="bi-public-feature-row">
            <span><Check className="h-4 w-4" /> {pageCount} pages</span>
            <span><Check className="h-4 w-4" /> Mobile friendly</span>
            <span><Check className="h-4 w-4" /> Quick follow-up</span>
          </div>
        </div>

        <div className="bi-public-card">
          {gate.logoUrl && (
            <div className="bi-public-card-logo">
              <img src={gate.logoUrl} alt={gate.brandName} />
            </div>
          )}
          <div className="mb-5">
            <p className="bi-public-eyebrow">{gate.eyebrow}</p>
            <h2 className="mt-2 text-2xl font-semibold tracking-tight">{gate.headline}</h2>
            <p className="mt-1 text-sm text-muted-foreground">{gate.subheadline}</p>
          </div>
        <form
          className="space-y-4"
          onSubmit={(e) => {
            e.preventDefault();
            const fd = new FormData(e.currentTarget);
            onSubmit({
              name: String(fd.get("name") ?? "").trim(),
              phone: String(fd.get("phone") ?? "").trim(),
              email: String(fd.get("email") ?? "").trim() || undefined,
              consent: fd.get("consent") === "on",
            });
          }}
        >
          <div className="space-y-2">
            <Label htmlFor="name">Name</Label>
            <Input id="name" name="name" required placeholder="Rahul Kumar" className="bi-public-input" autoComplete="name" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="phone">Phone number</Label>
            <Input
              id="phone"
              name="phone"
              required
              type="tel"
              placeholder="+91 98765 43210"
              className="bi-public-input"
              autoComplete="tel"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="email">Email (optional)</Label>
            <Input id="email" name="email" type="email" placeholder="you@email.com" className="bi-public-input" autoComplete="email" />
          </div>

          <BrochureConsentNotice />

          <Label htmlFor="consent" className="bi-public-consent-row">
            <Checkbox id="consent" name="consent" required className="bi-public-checkbox" />
            <span>
              <strong>I agree</strong>
              <small>
                I allow contact details and brochure usage information to be used for relevant follow-up.
              </small>
            </span>
          </Label>

          <Label htmlFor="contact-ok" className="bi-public-consent-row">
            <Checkbox id="contact-ok" name="contact-ok" defaultChecked className="bi-public-checkbox" />
            <span>
              <strong>Contact me about this brochure</strong>
              <small>The sales team may call or message me about pricing, availability, or a site visit.</small>
            </span>
          </Label>

          <div className="flex items-start gap-2 rounded-2xl bg-muted/50 p-3 text-xs text-muted-foreground">
            <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
            <p>
              Want the full explanation?{" "}
              <Link href={`/brochure/${slug}/privacy`} className="font-medium text-primary hover:underline" target="_blank">
                Open the data-use page
              </Link>
              .
            </p>
          </div>

          {error && (
            <div className="rounded-2xl border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
              {error}
            </div>
          )}

          <Button type="submit" className="bi-public-submit" disabled={loading}>
            {loading ? "Opening..." : gate.buttonLabel}
            {!loading && <ArrowRight className="ml-2 h-4 w-4" />}
          </Button>
        </form>
        </div>
      </section>
    </main>
  );
}
