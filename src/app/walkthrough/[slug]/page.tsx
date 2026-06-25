"use client";

import { Suspense, useCallback, useEffect, useRef, useState } from "react";
import { useParams, useSearchParams } from "next/navigation";
import { ScrollWalkthroughShell, type WalkthroughPlayerHandle } from "@/components/buyer/scroll-walkthrough-shell";
import { WalkthroughVoiceModeAgent } from "@/components/walkthrough/walkthrough-voice-mode-agent";
import { WalkthroughChatWidget } from "@/components/walkthrough/walkthrough-chat-widget";
import { WalkthroughSiteVisitWidget } from "@/components/walkthrough/walkthrough-site-visit-widget";
import type { WalkthroughAICommand } from "@/lib/walkthrough-player-controller";
import { isSceneIncluded } from "@/lib/walkthrough-scene-meta";
import { VIDEO_WALKTHROUGH_ANNOTATIONS_ENABLED } from "@/lib/walkthrough-video-features";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { WalkthroughScene } from "@/types/cinematic-walkthrough";
import { readJsonResponse } from "@/lib/http-json";
import { X } from "lucide-react";
import "@/styles/walkthrough-studio.css";

interface WalkthroughData {
  id: string;
  type: string;
  slug: string;
  organization_id: string;
  property_id: string;
  viewer_config?: Record<string, unknown> | null;
  properties?: { name: string; projects?: { name: string; branding?: { primary_color?: string; logo_url?: string } } };
  walkthrough_scenes?: WalkthroughScene[];
}

function WalkthroughViewerContent() {
  const params = useParams();
  const searchParams = useSearchParams();
  const slug = params.slug as string;
  const preview = searchParams.get("preview") === "1";
  const [data, setData] = useState<WalkthroughData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [aiCommand, setAiCommand] = useState<WalkthroughAICommand | null>(null);
  const playerRef = useRef<WalkthroughPlayerHandle>(null);
  const [activeSceneId, setActiveSceneId] = useState<string | undefined>();
  const [showLead, setShowLead] = useState(false);
  const [leadForm, setLeadForm] = useState({ name: "", phone: "" });

  const track = useCallback(async (eventType: string, payload?: Record<string, unknown>) => {
    if (!sessionId || !data) return;
    await fetch("/api/analytics/events", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        sessionId,
        propertyId: data.property_id,
        organizationId: data.organization_id,
        experienceId: data.id,
        eventType,
        payload: { ...payload, experienceType: "cinematic_walkthrough" },
      }),
    });
    await fetch("/api/walkthrough/viewer-events", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        sessionId,
        experienceId: data.id,
        propertyId: data.property_id,
        organizationId: data.organization_id,
        eventType,
        sceneId: payload?.sceneId,
        annotationId: payload?.annotationId,
        payload,
      }),
    }).catch(() => {});
  }, [sessionId, data]);

  const handleSceneEvent = useCallback((type: string, payload?: Record<string, unknown>) => {
    if (payload?.sceneId) setActiveSceneId(String(payload.sceneId));
    track(type, payload);
  }, [track]);

  useEffect(() => {
    setLoading(true);
    setError(null);
    fetch(`/api/experiences/public/${slug}${preview ? "?preview=1" : ""}`)
      .then(async (r) => {
        const body = await readJsonResponse<{ error?: string } & WalkthroughData>(r);
        if (!r.ok) throw new Error(body.error ?? "Walkthrough not found");
        return body;
      })
      .then((exp) => {
        if (exp.type && exp.type !== "cinematic_walkthrough") {
          throw new Error("This link is not a property walkthrough");
        }
        setData(exp);
      })
      .catch((e) => {
        setData(null);
        setError(e instanceof Error ? e.message : "Walkthrough not found");
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
      .then((r) => readJsonResponse<{ sessionId?: string; id?: string }>(r))
      .then((s) => setSessionId(s.sessionId ?? s.id ?? null))
      .catch(() => {});
  }, [data]);

  useEffect(() => {
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = ""; };
  }, []);

  if (loading) {
    return <div className="wt-viewer-shell flex items-center justify-center bg-black text-white">Loading walkthrough…</div>;
  }

  if (error || !data) {
    return (
      <div className="wt-viewer-shell flex flex-col items-center justify-center gap-3 bg-black px-6 text-center text-white">
        <p>{error ?? "Walkthrough not found"}</p>
        {preview && (
          <p className="text-sm text-white/70">
            If this is a new walkthrough, open Preview from the studio once scenes are generated.
          </p>
        )}
      </div>
    );
  }

  const scenes = (data.walkthrough_scenes ?? [])
    .filter(isSceneIncluded)
    .sort((a, b) => a.scene_order - b.scene_order);

  if (!scenes.length) {
    return (
      <div className="wt-viewer-shell flex flex-col items-center justify-center gap-3 bg-black px-6 text-center text-white">
        <p>No scenes in this walkthrough yet.</p>
        <p className="text-sm text-white/70">Upload photos and generate scenes in the walkthrough studio, then preview again.</p>
      </div>
    );
  }

  const branding = data.properties?.projects?.branding;

  return (
    <div className="relative h-[var(--wt-viewer-height,100dvh)] w-full bg-black">
      <ScrollWalkthroughShell
        ref={playerRef}
        scenes={scenes}
        projectName={data.properties?.projects?.name ?? "Project"}
        propertyName={data.properties?.name ?? "Property"}
        brandColor={branding?.primary_color}
        logoUrl={branding?.logo_url}
        onSceneEvent={handleSceneEvent}
        externalAICommand={aiCommand}
        onAICommand={(cmd) => {
          track("ai_navigation_command", { command: cmd.command });
          if (cmd.command === "OPEN_LEAD_FORM") setShowLead(true);
        }}
        onAnnotationClick={VIDEO_WALKTHROUGH_ANNOTATIONS_ENABLED ? (ann) => {
          if (ann.cta_label) track("annotation_cta_clicked", { annotationId: ann.id, title: ann.title });
        } : undefined}
        onContact={() => { setShowLead(true); track("lead_form_opened", {}); }}
      />

      <WalkthroughVoiceModeAgent
        organizationId={data.organization_id}
        propertyId={data.property_id}
        experienceId={data.id}
        sessionId={sessionId ?? undefined}
        propertyName={data.properties?.name ?? "Property"}
        projectName={data.properties?.projects?.name}
        viewerConfig={data.viewer_config}
        preview={preview}
        showDevTools={preview}
        scenes={scenes.map((s) => ({
          id: s.id,
          title: s.title,
          room_type: s.room_type,
        }))}
        activeSceneId={activeSceneId}
        onCommand={(cmd) => {
          if (cmd.command === "JUMP_TO_SCENE" && cmd.sceneId) {
            const navigated = playerRef.current?.goToScene(cmd.sceneId) ?? false;
            if (process.env.NODE_ENV === "development") {
              console.info("[walkthrough-nav] voice_onCommand", {
                sceneId: cmd.sceneId,
                navigated,
              });
            }
          } else {
            setAiCommand(cmd);
            requestAnimationFrame(() => setAiCommand(null));
          }
          if (cmd.command === "OPEN_LEAD_FORM") setShowLead(true);
        }}
        onTrack={(eventType, payload) => track(eventType, payload)}
      />

      <WalkthroughChatWidget
        organizationId={data.organization_id}
        propertyId={data.property_id}
        experienceId={data.id}
        sessionId={sessionId ?? undefined}
        propertyName={data.properties?.name ?? "Property"}
        viewerConfig={data.viewer_config}
        activeSceneId={activeSceneId}
        onCommand={(cmd) => {
          if (cmd.command === "JUMP_TO_SCENE" && cmd.sceneId) {
            playerRef.current?.goToScene(cmd.sceneId);
          } else {
            setAiCommand(cmd);
            requestAnimationFrame(() => setAiCommand(null));
          }
          if (cmd.command === "OPEN_LEAD_FORM") setShowLead(true);
        }}
        onTrack={(eventType, payload) => track(eventType, payload)}
      />

      {showLead && (
        <>
          <button
            type="button"
            className="wt-sheet-backdrop"
            aria-label="Close contact form"
            onClick={() => setShowLead(false)}
          />
          <div className="wt-sheet" role="dialog" aria-modal="true" aria-label="Contact sales">
          <div className="wt-sheet-handle" />
          <div className="wt-sheet-header">
            <span className="font-semibold">Contact sales</span>
            <button type="button" className="wt-sheet-close min-h-[44px] min-w-[44px] rounded-full p-2" onClick={() => setShowLead(false)} aria-label="Close">
              <X className="h-5 w-5" />
            </button>
          </div>
          <div className="wt-sheet-body space-y-4 p-4">
            <div>
              <Label>Name</Label>
              <Input className="mt-1 min-h-[44px] text-base" value={leadForm.name} onChange={(e) => setLeadForm({ ...leadForm, name: e.target.value })} />
            </div>
            <div>
              <Label>Phone</Label>
              <Input className="mt-1 min-h-[44px] text-base" type="tel" inputMode="tel" value={leadForm.phone} onChange={(e) => setLeadForm({ ...leadForm, phone: e.target.value })} />
            </div>
            <Button
              className="w-full min-h-[48px]"
              onClick={async () => {
                await fetch("/api/leads", {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({
                    property_id: data.property_id,
                    organization_id: data.organization_id,
                    session_id: sessionId,
                    name: leadForm.name,
                    phone: leadForm.phone,
                    source: "cinematic_walkthrough",
                  }),
                });
                track("lead_submitted", leadForm);
                setShowLead(false);
              }}
            >
              Submit
            </Button>
          </div>
        </div>
        </>
      )}

      {!showLead && (
      <WalkthroughSiteVisitWidget
        propertyId={data.property_id}
        sessionId={sessionId}
        propertyName={data.properties?.name}
      />
      )}
    </div>
  );
}

export default function WalkthroughPublicPage() {
  return (
    <Suspense fallback={<div className="wt-viewer-shell flex items-center justify-center bg-black text-white">Loading walkthrough…</div>}>
      <WalkthroughViewerContent />
    </Suspense>
  );
}
