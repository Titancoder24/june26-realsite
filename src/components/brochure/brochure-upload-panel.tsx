"use client";

import { useRef, useState } from "react";
import { BookOpen, MessageCircle, Phone, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  DEFAULT_FLIPBOOK_SETTINGS,
  FLIPBOOK_PRESET_OPTIONS,
  FLIPBOOK_SOUND_OPTIONS,
} from "@/lib/brochure-flipbook-options";
import type { BrochureFlipbookPresetId, BrochureFlipbookSoundId } from "@/types/brochure-intelligence";

export function BrochureUploadPanel({
  properties,
  onUploaded,
}: {
  properties: { id: string; name: string }[];
  onUploaded: (brochure: { id: string; slug: string }) => void;
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [title, setTitle] = useState("");
  const [propertyId, setPropertyId] = useState("");
  const [viewerMode, setViewerMode] = useState<"pdf" | "flipbook">("pdf");
  const [flipbookSoundId, setFlipbookSoundId] = useState<BrochureFlipbookSoundId>(DEFAULT_FLIPBOOK_SETTINGS.soundId);
  const [flipbookPresetId, setFlipbookPresetId] = useState<BrochureFlipbookPresetId>(DEFAULT_FLIPBOOK_SETTINGS.presetId);
  const [whatsappPhone, setWhatsappPhone] = useState("");
  const [callPhone, setCallPhone] = useState("");
  const [siteVisitUrl, setSiteVisitUrl] = useState("");
  const [enquireUrl, setEnquireUrl] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleUpload = async () => {
    const file = fileRef.current?.files?.[0];
    if (!file || !title.trim()) {
      setError("Title and PDF file are required");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const form = new FormData();
      form.append("file", file);
      form.append("title", title.trim());
      if (propertyId) form.append("propertyId", propertyId);
      form.append("viewerMode", viewerMode);
      const ctas = [
        whatsappPhone.trim()
          ? { type: "whatsapp", label: "WhatsApp", phone: whatsappPhone.trim() }
          : null,
        callPhone.trim() ? { type: "call", label: "Call Now", phone: callPhone.trim() } : null,
        siteVisitUrl.trim()
          ? { type: "site_visit", label: "Book Site Visit", url: siteVisitUrl.trim() }
          : { type: "site_visit", label: "Book Site Visit" },
        enquireUrl.trim() ? { type: "enquire", label: "Enquire Now", url: enquireUrl.trim() } : null,
        { type: "download", label: "Download Brochure" },
      ].filter(Boolean);
      form.append(
        "settings",
        JSON.stringify({
          ctas,
          leadGate: {
            brandName: "Smart brochure",
            eyebrow: "View brochure",
            headline: "Your details",
            subheadline: "This takes less than 10 seconds.",
            helperText: "Enter your details once and open the full brochure in a clean premium viewer.",
            buttonLabel: "View Brochure",
            primaryColor: "#10b981",
            accentColor: "#0f172a",
            theme: "glass",
            layout: "split",
          },
          flipbook: {
            soundId: flipbookSoundId,
            presetId: flipbookPresetId,
          },
        }),
      );
      const res = await fetch("/api/brochures/upload", { method: "POST", body: form });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Upload failed");
      onUploaded(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bi-upload-panel">
      <div className="flex items-center gap-3">
        <div className="rounded-2xl bg-primary/10 p-3 text-primary">
          <Upload className="h-5 w-5" />
        </div>
        <div>
          <h2 className="text-xl font-semibold tracking-tight">Upload Brochure PDF</h2>
          <p className="text-sm text-muted-foreground">
            Create a smart link with lead capture, consent, CTAs, PDF/flipbook viewing, and analytics.
          </p>
        </div>
      </div>

      <div className="mt-6 grid gap-4 md:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="brochure-title">Brochure title</Label>
          <Input id="brochure-title" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Pearl County Phase 2" />
        </div>
        <div className="space-y-2">
          <Label>Property (optional)</Label>
          <Select value={propertyId} onValueChange={setPropertyId}>
            <SelectTrigger>
              <SelectValue placeholder="Link to property" />
            </SelectTrigger>
            <SelectContent>
              {properties.map((p) => (
                <SelectItem key={p.id} value={p.id}>
                  {p.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label>Viewer mode</Label>
          <div className="grid gap-3 sm:grid-cols-2">
            <button
              type="button"
              className={`bi-viewer-mode-card ${viewerMode === "pdf" ? "is-active" : ""}`}
              onClick={() => setViewerMode("pdf")}
            >
              <BookOpen className="h-5 w-5" />
              <span>PDF Viewer</span>
              <small>Fast, scrollable, mobile friendly</small>
            </button>
            <button
              type="button"
              className={`bi-viewer-mode-card ${viewerMode === "flipbook" ? "is-active" : ""}`}
              onClick={() => setViewerMode("flipbook")}
            >
              <BookOpen className="h-5 w-5" />
              <span>Flipbook</span>
              <small>Premium magazine experience</small>
            </button>
          </div>
        </div>
        <div className="space-y-2">
          <Label htmlFor="brochure-file">PDF file</Label>
          <Input id="brochure-file" ref={fileRef} type="file" accept="application/pdf" />
        </div>
      </div>

      {viewerMode === "flipbook" && (
        <div className="mt-6 rounded-2xl border bg-muted/35 p-4">
          <div className="mb-4">
            <h3 className="font-medium">Flipbook interaction</h3>
            <p className="text-xs text-muted-foreground">
              Choose how the brochure feels when buyers turn pages.
            </p>
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label>Page-turn sound</Label>
              <Select value={flipbookSoundId} onValueChange={(v) => setFlipbookSoundId(v as BrochureFlipbookSoundId)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {FLIPBOOK_SOUND_OPTIONS.map((option) => (
                    <SelectItem key={option.id} value={option.id}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                {FLIPBOOK_SOUND_OPTIONS.find((option) => option.id === flipbookSoundId)?.description}
              </p>
            </div>
            <div className="space-y-2">
              <Label>Flipbook style</Label>
              <Select value={flipbookPresetId} onValueChange={(v) => setFlipbookPresetId(v as BrochureFlipbookPresetId)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {FLIPBOOK_PRESET_OPTIONS.map((option) => (
                    <SelectItem key={option.id} value={option.id}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                {FLIPBOOK_PRESET_OPTIONS.find((option) => option.id === flipbookPresetId)?.description}
              </p>
            </div>
          </div>
          <div className="bi-flipbook-option-grid mt-4">
            {FLIPBOOK_PRESET_OPTIONS.slice(0, 12).map((option) => (
              <button
                key={option.id}
                type="button"
                className={option.id === flipbookPresetId ? "is-active" : ""}
                onClick={() => setFlipbookPresetId(option.id)}
              >
                <span>{option.label}</span>
                <small>{option.description}</small>
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="mt-6 rounded-2xl border bg-muted/35 p-4">
        <div className="mb-4 flex items-center gap-2">
          <MessageCircle className="h-4 w-4 text-primary" />
          <h3 className="font-medium">CTA buttons</h3>
          <p className="text-xs text-muted-foreground">Shown inside the buyer viewer and tracked as intent.</p>
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="brochure-whatsapp">WhatsApp number</Label>
            <Input
              id="brochure-whatsapp"
              value={whatsappPhone}
              onChange={(e) => setWhatsappPhone(e.target.value)}
              placeholder="+91 98765 43210"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="brochure-call" className="flex items-center gap-1">
              <Phone className="h-3.5 w-3.5" /> Call number
            </Label>
            <Input
              id="brochure-call"
              value={callPhone}
              onChange={(e) => setCallPhone(e.target.value)}
              placeholder="+91 98765 43210"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="brochure-site-visit">Book site visit URL</Label>
            <Input
              id="brochure-site-visit"
              value={siteVisitUrl}
              onChange={(e) => setSiteVisitUrl(e.target.value)}
              placeholder="https://example.com/site-visit"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="brochure-enquire">Enquiry URL</Label>
            <Input
              id="brochure-enquire"
              value={enquireUrl}
              onChange={(e) => setEnquireUrl(e.target.value)}
              placeholder="https://example.com/enquire"
            />
          </div>
        </div>
      </div>

      {error && <p className="mt-3 text-sm text-destructive">{error}</p>}

      <Button className="mt-6" onClick={() => void handleUpload()} disabled={loading}>
        {loading ? "Uploading…" : "Upload & Generate Link"}
      </Button>
    </div>
  );
}
