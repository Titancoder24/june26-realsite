"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { BarChart3, CheckCircle2, Copy, ExternalLink, FileText, Flame, Layers3, MousePointerClick } from "lucide-react";
import { RoleGuard } from "@/components/auth/role-guard";
import { BrochureExperiencePreview } from "@/components/brochure/brochure-experience-preview";
import { BrochureLeadGateGenerator } from "@/components/brochure/brochure-lead-gate-generator";
import { BrochureSectionEditor } from "@/components/brochure/brochure-section-editor";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import { DEFAULT_FLIPBOOK_SETTINGS } from "@/lib/brochure-flipbook-options";
import type {
  BrochureFlipbookPresetId,
  BrochureFlipbookSoundId,
  BrochureSection,
  BrochureSettings,
} from "@/types/brochure-intelligence";

type BrochureDetail = {
  id: string;
  title: string;
  slug: string;
  file_url: string;
  page_count: number;
  viewer_mode: "pdf" | "flipbook";
  status?: "draft" | "active" | "archived";
  settings?: BrochureSettings;
  properties?: { name: string } | null;
  brochure_page_sections?: BrochureSection[];
};

function isBrochureDetail(value: unknown): value is BrochureDetail {
  if (!value || typeof value !== "object") return false;
  const row = value as Partial<BrochureDetail> & { error?: string };
  return Boolean(row.id && row.title && row.slug && row.file_url && Number(row.page_count) > 0 && !row.error);
}

export default function BrochureDetailPage({ params }: { params: Promise<{ brochureId: string }> }) {
  const [brochureId, setBrochureId] = useState("");
  const [brochure, setBrochure] = useState<BrochureDetail | null>(null);
  const [viewerMode, setViewerMode] = useState<"pdf" | "flipbook">("pdf");
  const [flipbookSoundId, setFlipbookSoundId] = useState<BrochureFlipbookSoundId>(DEFAULT_FLIPBOOK_SETTINGS.soundId);
  const [flipbookPresetId, setFlipbookPresetId] = useState<BrochureFlipbookPresetId>(DEFAULT_FLIPBOOK_SETTINGS.presetId);
  const [savingMode, setSavingMode] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    void params.then(({ brochureId: id }) => {
      setBrochureId(id);
      void (async () => {
        setLoading(true);
        setLoadError(null);
        try {
          const detailRes = await fetch(`/api/brochures/${id}`);
          const detailData = await detailRes.json();
          let nextBrochure: BrochureDetail | null = isBrochureDetail(detailData) ? detailData : null;

          // Fallback: if the detail endpoint returns an auth/DB error object, recover from the list endpoint.
          if (!nextBrochure) {
            const listRes = await fetch("/api/brochures");
            const listData = await listRes.json();
            const fallback = Array.isArray(listData) ? listData.find((b) => b.id === id) : null;
            nextBrochure = isBrochureDetail(fallback) ? fallback : null;
          }

          if (!nextBrochure) {
            const message = typeof detailData?.error === "string" ? detailData.error : "Could not load brochure PDF details";
            throw new Error(message);
          }

          setBrochure(nextBrochure);
          setViewerMode(nextBrochure.viewer_mode ?? "pdf");
          setFlipbookSoundId(nextBrochure.settings?.flipbook?.soundId ?? DEFAULT_FLIPBOOK_SETTINGS.soundId);
          setFlipbookPresetId(nextBrochure.settings?.flipbook?.presetId ?? DEFAULT_FLIPBOOK_SETTINGS.presetId);
        } catch (err) {
          setBrochure(null);
          setLoadError(err instanceof Error ? err.message : "Could not load brochure");
        } finally {
          setLoading(false);
        }
      })();
    });
  }, [params]);

  const shareUrl =
    typeof window !== "undefined" && brochure?.slug
      ? `${window.location.origin}/brochure/${brochure.slug}`
      : "";
  const campaignShareUrl = shareUrl
    ? `${shareUrl}?utm_source=whatsapp&utm_medium=sales_agent&utm_campaign=your_campaign&agent=YOUR_ID`
    : "";

  const copyLink = () => {
    if (!campaignShareUrl) return;
    void navigator.clipboard.writeText(campaignShareUrl);
    toast.success("Smart link copied");
  };

  const saveViewerMode = async (mode: "pdf" | "flipbook") => {
    setViewerMode(mode);
    setSavingMode(true);
    try {
      const res = await fetch(`/api/brochures/${brochureId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ viewerMode: mode }),
      });
      if (!res.ok) throw new Error("Could not update viewer mode");
      toast.success(`Viewer mode set to ${mode}`);
    } catch {
      toast.error("Failed to update viewer mode");
    } finally {
      setSavingMode(false);
    }
  };

  const saveFlipbookSettings = async (
    next: Partial<{ soundId: BrochureFlipbookSoundId; presetId: BrochureFlipbookPresetId }>,
  ) => {
    if (!brochure) return;
    const nextFlipbook = {
      soundId: next.soundId ?? flipbookSoundId,
      presetId: next.presetId ?? flipbookPresetId,
    };
    setFlipbookSoundId(nextFlipbook.soundId);
    setFlipbookPresetId(nextFlipbook.presetId);
    setSavingMode(true);
    try {
      const settings: BrochureSettings = {
        ...(brochure.settings ?? {}),
        flipbook: nextFlipbook,
      };
      const res = await fetch(`/api/brochures/${brochureId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ settings }),
      });
      const updated = await res.json();
      if (!res.ok) throw new Error(updated.error ?? "Could not update flipbook settings");
      setBrochure({ ...brochure, settings });
      toast.success("Flipbook settings saved");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to update flipbook settings");
    } finally {
      setSavingMode(false);
    }
  };

  const publishBrochure = async () => {
    if (!brochure) return;
    setPublishing(true);
    try {
      const res = await fetch(`/api/brochures/${brochure.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "active" }),
      });
      const updated = await res.json();
      if (!res.ok) throw new Error(updated.error ?? "Could not publish brochure");
      setBrochure({ ...brochure, status: "active" });
      toast.success("Brochure published");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to publish brochure");
    } finally {
      setPublishing(false);
    }
  };

  return (
    <RoleGuard minRole="sales_agent">
      <div className="bi-dashboard p-6">
        {loadError && (
          <Card className="bi-card border-destructive/40 bg-destructive/5">
            <CardContent className="p-4 text-sm text-destructive">
              {loadError}. Go back to Brochures and open the brochure again.
            </CardContent>
          </Card>
        )}
        <div className="bi-hero">
          <div>
            <Link href="/dashboard/brochures" className="text-sm text-muted-foreground hover:underline">
              ← Brochures
            </Link>
            <p className="mt-4 text-sm font-medium uppercase tracking-[0.2em] text-primary">Brochure Intelligence</p>
            <h1 className="mt-2">{brochure?.title ?? "Brochure"}</h1>
            <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
              Configure the smart PDF viewer, annotate sales sections, copy a campaign-ready link, and turn every brochure open into buyer intent.
            </p>
            <div className="mt-4 flex flex-wrap gap-2 text-xs">
              <span className="bi-pill"><FileText className="h-3.5 w-3.5" /> {loading ? "Loading" : brochure?.page_count ?? 0} pages</span>
              <span className="bi-pill"><Layers3 className="h-3.5 w-3.5" /> {viewerMode} viewer</span>
              <span className="bi-pill"><MousePointerClick className="h-3.5 w-3.5" /> section tracking</span>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            {brochure?.status === "active" ? (
              <span className="bi-pill bg-emerald-50 text-emerald-700">
                <CheckCircle2 className="h-3.5 w-3.5" /> Published
              </span>
            ) : brochure ? (
              <Button variant="outline" size="sm" onClick={() => void publishBrochure()} disabled={publishing}>
                <CheckCircle2 className="mr-1 h-4 w-4" />
                {publishing ? "Publishing..." : "Publish brochure"}
              </Button>
            ) : null}
            {shareUrl && (
              <>
                <Button variant="outline" size="sm" onClick={copyLink}>
                  <Copy className="mr-1 h-4 w-4" /> Copy link
                </Button>
                <Button asChild variant="outline" size="sm">
                  <a href={shareUrl} target="_blank" rel="noreferrer">
                    <ExternalLink className="mr-1 h-4 w-4" /> Preview
                  </a>
                </Button>
              </>
            )}
            <Button asChild size="sm">
              <Link href={`/dashboard/brochures/${brochureId}/reports`}>
                <BarChart3 className="mr-1 h-4 w-4" /> Reports
              </Link>
            </Button>
          </div>
        </div>

        <div className="bi-stat-grid">
          <Card className="bi-card bi-gradient-card">
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-sm text-muted-foreground">
                <FileText className="h-4 w-4" /> Brochure
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-semibold">{brochure?.page_count ?? 0}</p>
              <p className="text-xs text-muted-foreground">pages uploaded</p>
            </CardContent>
          </Card>
          <Card className="bi-card bi-gradient-card">
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-sm text-muted-foreground">
                <Flame className="h-4 w-4" /> Intelligence
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-semibold">{brochure?.brochure_page_sections?.length ?? 0}</p>
              <p className="text-xs text-muted-foreground">tracked sections</p>
            </CardContent>
          </Card>
          <Card className="bi-card bi-gradient-card">
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-sm text-muted-foreground">
                <Layers3 className="h-4 w-4" /> Experience
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-semibold capitalize">{viewerMode}</p>
              <p className="text-xs text-muted-foreground">buyer viewer mode</p>
            </CardContent>
          </Card>
        </div>

        <div>
          <Card className="bi-card">
            <CardHeader>
              <CardTitle>Smart share link</CardTitle>
            </CardHeader>
            <CardContent>
              <code className="block break-all rounded-lg bg-muted px-3 py-2 text-sm">
                {campaignShareUrl || "Loading..."}
              </code>
            </CardContent>
          </Card>
        </div>

        {brochure?.file_url && brochure.page_count > 0 && (
          <>
            <BrochureLeadGateGenerator
              brochureId={brochure.id}
              title={brochure.title}
              settings={brochure.settings}
              onSaved={(settings) => setBrochure({ ...brochure, settings })}
            />
            <BrochureExperiencePreview
              fileUrl={brochure.file_url}
              title={brochure.title}
              pageCount={brochure.page_count}
              flipbookSettings={brochure.settings?.flipbook}
              viewerMode={viewerMode}
              savingSettings={savingMode}
              onViewerModeChange={(mode) => void saveViewerMode(mode)}
              onFlipbookSettingsChange={(settings) => void saveFlipbookSettings(settings)}
            />
            <BrochureSectionEditor
              brochureId={brochure.id}
              fileUrl={brochure.file_url}
              pageCount={brochure.page_count}
              initialSections={brochure.brochure_page_sections ?? []}
              onSaved={(sections) => setBrochure({ ...brochure, brochure_page_sections: sections })}
            />
          </>
        )}
      </div>
    </RoleGuard>
  );
}
