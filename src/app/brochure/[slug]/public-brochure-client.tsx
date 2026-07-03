"use client";

import { use, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import "@/styles/brochure-intelligence.css";
import { BrochureLeadGate } from "@/components/brochure/brochure-lead-gate";
import { BrochureViewer } from "@/components/brochure/brochure-viewer";
import { BrochureFlipbookViewer } from "@/components/brochure/brochure-flipbook-viewer";
import type {
  BrochureCta,
  BrochureFlipbookSettings,
  BrochureLeadGateSettings,
  BrochureSection,
} from "@/types/brochure-intelligence";

type PublicBrochure = {
  id: string;
  title: string;
  slug: string;
  file_url: string;
  page_count: number;
  viewer_mode: string;
  settings?: { ctas?: BrochureCta[]; leadGate?: BrochureLeadGateSettings; flipbook?: BrochureFlipbookSettings };
  brochure_page_sections?: BrochureSection[];
};

function optionalUuidFromQuery(value: string | null) {
  if (!value) return undefined;
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)
    ? value
    : undefined;
}

export default function PublicBrochurePageInner({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = use(params);
  const searchParams = useSearchParams();
  const [brochure, setBrochure] = useState<PublicBrochure | null>(null);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);

  useEffect(() => {
    void fetch(`/api/brochures/public/${slug}`)
      .then((r) => r.json())
      .then((data) => {
        if (data.error) setLoadError(data.error);
        else setBrochure(data);
      })
      .catch(() => setLoadError("Brochure not found"))
      .finally(() => setLoading(false));
  }, [slug]);

  const submitLead = async (data: { name: string; phone: string; email?: string; consent: boolean }) => {
    if (!brochure) return;
    setSubmitting(true);
    setSubmitError(null);
    try {
      const res = await fetch("/api/brochures/leads", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          brochureId: brochure.id,
          name: data.name,
          phone: data.phone,
          email: data.email,
          consent: data.consent,
          utmSource: searchParams.get("utm_source") ?? undefined,
          utmMedium: searchParams.get("utm_medium") ?? undefined,
          utmCampaign: searchParams.get("utm_campaign") ?? undefined,
          agentId: optionalUuidFromQuery(searchParams.get("agent")),
          screenWidth: window.innerWidth,
          screenHeight: window.innerHeight,
          language: navigator.language,
          timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        }),
      });
      const result = await res.json();
      if (!res.ok) throw new Error(result.error ?? "Could not start session");
      setSessionId(result.session.id);
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : "Submission failed");
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return <div className="bi-public-loading">Opening smart brochure...</div>;
  }
  if (loadError || !brochure) {
    return <div className="bi-public-loading text-destructive">{loadError ?? "Not found"}</div>;
  }

  if (!sessionId) {
    return (
      <BrochureLeadGate
        title={brochure.title}
        slug={brochure.slug}
        fileUrl={brochure.file_url}
        pageCount={brochure.page_count}
        viewerMode={brochure.viewer_mode}
        settings={brochure.settings?.leadGate}
        onSubmit={(d) => void submitLead(d)}
        loading={submitting}
        error={submitError}
      />
    );
  }

  const viewerProps = {
    fileUrl: brochure.file_url,
    sessionId,
    brochureId: brochure.id,
    pageCount: brochure.page_count,
    sections: brochure.brochure_page_sections ?? [],
    ctas: brochure.settings?.ctas ?? [],
    title: brochure.title,
    flipbookSettings: brochure.settings?.flipbook,
  };

  if (brochure.viewer_mode === "flipbook") {
    return <BrochureFlipbookViewer {...viewerProps} />;
  }

  return <BrochureViewer {...viewerProps} />;
}
