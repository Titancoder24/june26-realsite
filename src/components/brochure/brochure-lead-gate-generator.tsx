"use client";

import { useState } from "react";
import type { CSSProperties } from "react";
import { Paintbrush, Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { BrochureLeadGateSettings, BrochureSettings } from "@/types/brochure-intelligence";

const defaultLeadGate: Required<BrochureLeadGateSettings> = {
  brandName: "Smart brochure",
  logoUrl: "",
  eyebrow: "View brochure",
  headline: "Your details",
  subheadline: "This takes less than 10 seconds.",
  helperText: "Enter your details once and open the full brochure in a clean premium viewer.",
  buttonLabel: "View Brochure",
  primaryColor: "#10b981",
  accentColor: "#0f172a",
  theme: "glass",
  layout: "split",
};

export function BrochureLeadGateGenerator({
  brochureId,
  title,
  settings,
  onSaved,
}: {
  brochureId: string;
  title: string;
  settings?: BrochureSettings;
  onSaved: (settings: BrochureSettings) => void;
}) {
  const [gate, setGate] = useState<Required<BrochureLeadGateSettings>>({
    ...defaultLeadGate,
    ...(settings?.leadGate ?? {}),
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const update = <K extends keyof Required<BrochureLeadGateSettings>>(key: K, value: Required<BrochureLeadGateSettings>[K]) => {
    setGate((prev) => ({ ...prev, [key]: value }));
  };

  const save = async () => {
    setSaving(true);
    setError(null);
    try {
      const nextSettings: BrochureSettings = {
        ...(settings ?? {}),
        leadGate: {
          ...gate,
          logoUrl: gate.logoUrl.trim() || undefined,
        },
      };
      const res = await fetch(`/api/brochures/${brochureId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ settings: nextSettings }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Could not save pop-up settings");
      onSaved(data.settings ?? nextSettings);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save pop-up settings");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card className="bi-card overflow-hidden">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Paintbrush className="h-5 w-5 text-primary" />
          Lead Pop-up Generator
        </CardTitle>
        <p className="text-sm text-muted-foreground">
          Customize the buyer form with your logo, colors, copy, and theme. This is what buyers see before the brochure opens.
        </p>
      </CardHeader>
      <CardContent>
        <div className="bi-popup-generator-grid">
          <div className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label>Brand name</Label>
                <Input value={gate.brandName} onChange={(e) => update("brandName", e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>Logo URL</Label>
                <Input value={gate.logoUrl} onChange={(e) => update("logoUrl", e.target.value)} placeholder="https://..." />
              </div>
              <div className="space-y-2">
                <Label>Small label</Label>
                <Input value={gate.eyebrow} onChange={(e) => update("eyebrow", e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>Button text</Label>
                <Input value={gate.buttonLabel} onChange={(e) => update("buttonLabel", e.target.value)} />
              </div>
              <div className="space-y-2 md:col-span-2">
                <Label>Headline</Label>
                <Input value={gate.headline} onChange={(e) => update("headline", e.target.value)} />
              </div>
              <div className="space-y-2 md:col-span-2">
                <Label>Subheadline</Label>
                <Input value={gate.subheadline} onChange={(e) => update("subheadline", e.target.value)} />
              </div>
              <div className="space-y-2 md:col-span-2">
                <Label>Left-side helper text</Label>
                <Input value={gate.helperText} onChange={(e) => update("helperText", e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>Primary color</Label>
                <div className="flex gap-2">
                  <Input type="color" value={gate.primaryColor} onChange={(e) => update("primaryColor", e.target.value)} className="w-16 p-1" />
                  <Input value={gate.primaryColor} onChange={(e) => update("primaryColor", e.target.value)} />
                </div>
              </div>
              <div className="space-y-2">
                <Label>Accent color</Label>
                <div className="flex gap-2">
                  <Input type="color" value={gate.accentColor} onChange={(e) => update("accentColor", e.target.value)} className="w-16 p-1" />
                  <Input value={gate.accentColor} onChange={(e) => update("accentColor", e.target.value)} />
                </div>
              </div>
              <div className="space-y-2">
                <Label>Theme</Label>
                <Select value={gate.theme} onValueChange={(v) => update("theme", v as Required<BrochureLeadGateSettings>["theme"])}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="glass">Glass</SelectItem>
                    <SelectItem value="light">Light</SelectItem>
                    <SelectItem value="dark">Dark</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Layout</Label>
                <Select value={gate.layout} onValueChange={(v) => update("layout", v as Required<BrochureLeadGateSettings>["layout"])}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="split">Split with brochure preview</SelectItem>
                    <SelectItem value="centered">Centered pop-up</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {error && <p className="text-sm text-destructive">{error}</p>}
            <Button onClick={() => void save()} disabled={saving}>
              <Save className="mr-2 h-4 w-4" />
              {saving ? "Saving..." : "Save pop-up"}
            </Button>
          </div>

          <div className="bi-popup-preview" style={{ "--bi-public-primary": gate.primaryColor, "--bi-public-accent": gate.accentColor } as CSSProperties}>
            <div className="bi-popup-preview-card">
              {gate.logoUrl ? <img src={gate.logoUrl} alt="" /> : <div className="bi-popup-preview-logo">{gate.brandName.slice(0, 1)}</div>}
              <p>{gate.eyebrow}</p>
              <h3>{gate.headline}</h3>
              <small>{gate.subheadline}</small>
              <div className="bi-popup-preview-input">Name</div>
              <div className="bi-popup-preview-input">Phone number</div>
              <div className="bi-popup-preview-check">✓ I agree</div>
              <button type="button">{gate.buttonLabel}</button>
            </div>
            <span className="bi-popup-preview-title">{title}</span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
