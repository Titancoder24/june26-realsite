"use client";

import { Suspense, useCallback, useEffect, useState } from "react";
import { useParams, useSearchParams } from "next/navigation";
import { ImageWalkthroughViewer } from "@/components/image-walkthrough/image-walkthrough-viewer";
import type {
  ImageWalkthroughAnnotation,
  ImageWalkthroughHotspot,
  ImageWalkthroughNode,
} from "@/types/image-walkthrough";
import "@/styles/image-walkthrough.css";
import "@/styles/walkthrough-studio.css";

interface WalkthroughData {
  id: string;
  slug: string;
  organization_id: string;
  property_id: string;
  nodes: ImageWalkthroughNode[];
  hotspots: ImageWalkthroughHotspot[];
  annotations: ImageWalkthroughAnnotation[];
  settings?: { start_node_id?: string | null; enable_depth_view?: boolean };
  properties?: { name: string };
}

function ImageWalkthroughPageContent() {
  const params = useParams();
  const searchParams = useSearchParams();
  const slug = params.slug as string;
  const preview = searchParams.get("preview") === "1";
  const [data, setData] = useState<WalkthroughData | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [sessionId, setSessionId] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    setLoadError(null);
    fetch(`/api/image-walkthrough/public/${slug}${preview ? "?preview=1" : ""}`)
      .then(async (r) => {
        const body = await r.json().catch(() => ({}));
        if (!r.ok) throw new Error(body.error ?? "Image walkthrough not found");
        return body;
      })
      .then(setData)
      .catch((e) => {
        setData(null);
        setLoadError(e instanceof Error ? e.message : "Image walkthrough not found");
      })
      .finally(() => setLoading(false));
  }, [slug, preview]);

  useEffect(() => {
    if (!data) return;
    fetch("/api/sessions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        propertyId: data.property_id,
        organizationId: data.organization_id,
        experienceId: data.id,
      }),
    })
      .then((r) => r.json())
      .then((s) => setSessionId(s.sessionId ?? s.id ?? null))
      .catch(() => {});
  }, [data]);

  const track = useCallback(async (eventType: string, payload?: Record<string, unknown>) => {
    if (!sessionId || !data) return;
    await fetch("/api/walkthrough/viewer-events", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        sessionId,
        experienceId: data.id,
        propertyId: data.property_id,
        organizationId: data.organization_id,
        eventType,
        payload: { ...payload, experienceType: "image_walkthrough" },
      }),
    }).catch(() => {});
  }, [sessionId, data]);

  useEffect(() => {
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = ""; };
  }, []);

  if (loading) {
    return <div className="iw-viewer-empty">Loading walkthrough…</div>;
  }

  if (!data) {
    return (
      <div className="iw-viewer-empty flex-col gap-2 px-6 text-center">
        <p>{loadError ?? "Image walkthrough not found"}</p>
        {preview && (
          <p className="text-sm opacity-70">Open preview from the studio using the Preview button — it prepares the walkthrough first.</p>
        )}
      </div>
    );
  }

  const startId = data.settings?.start_node_id ?? data.nodes.find((n) => n.is_start_node)?.id ?? data.nodes[0]?.id;

  return (
    <ImageWalkthroughViewer
      nodes={data.nodes}
      hotspots={data.hotspots}
      annotations={data.annotations}
      startNodeId={startId}
      propertyId={data.property_id}
      organizationId={data.organization_id}
      sessionId={sessionId}
      propertyName={data.properties?.name}
      preview={preview}
      defaultDepthView={Boolean(data.settings?.enable_depth_view)}
      onEvent={track}
    />
  );
}

export default function ImageWalkthroughPublicPage() {
  return (
    <Suspense fallback={<div className="iw-viewer-empty">Loading…</div>}>
      <ImageWalkthroughPageContent />
    </Suspense>
  );
}
