"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { resolveKeyboardCommand } from "@/lib/walkthrough-player-controller";
import { getNodeDisplayImageUrl } from "@/lib/image-walkthrough-utils";
import { useImageDepthParallax } from "@/hooks/use-image-depth-parallax";
import {
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Layers,
  LayoutGrid,
  Loader2,
  Maximize2,
  MessageCircle,
  Minimize2,
  Send,
  X,
} from "lucide-react";
import type {
  ImageWalkthroughAnnotation,
  ImageWalkthroughHotspot,
  ImageWalkthroughNode,
} from "@/types/image-walkthrough";
import { WalkthroughSiteVisitWidget } from "@/components/walkthrough/walkthrough-site-visit-widget";

export function ImageWalkthroughViewer({
  nodes,
  hotspots,
  annotations,
  startNodeId,
  propertyId,
  organizationId,
  propertyName,
  sessionId,
  preview,
  embedded,
  defaultDepthView = false,
  onEvent,
}: {
  nodes: ImageWalkthroughNode[];
  hotspots: ImageWalkthroughHotspot[];
  annotations: ImageWalkthroughAnnotation[];
  startNodeId?: string;
  propertyId?: string;
  organizationId?: string;
  propertyName?: string;
  sessionId?: string | null;
  preview?: boolean;
  embedded?: boolean;
  defaultDepthView?: boolean;
  onEvent?: (type: string, payload?: Record<string, unknown>) => void;
}) {
  const orderedNodes = useMemo(
    () => [...nodes].sort((a, b) => (a.node_order ?? 0) - (b.node_order ?? 0)),
    [nodes],
  );

  const [currentId, setCurrentId] = useState(startNodeId ?? orderedNodes[0]?.id);
  const [history, setHistory] = useState<string[]>([]);
  const [fitMode, setFitMode] = useState<"contain" | "cover">("contain");
  const [showRoomMenu, setShowRoomMenu] = useState(false);
  const [showHint, setShowHint] = useState(true);
  const [activeAnn, setActiveAnn] = useState<ImageWalkthroughAnnotation | null>(null);
  const [transitioning, setTransitioning] = useState(false);
  const [showAI, setShowAI] = useState(false);
  const [aiInput, setAiInput] = useState("");
  const [aiLoading, setAiLoading] = useState(false);
  const [aiMessages, setAiMessages] = useState<{ role: "user" | "assistant"; content: string }[]>([]);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [depthView, setDepthView] = useState(defaultDepthView);
  const rootRef = useRef<HTMLDivElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const startRef = useRef<number>(Date.now());

  const currentIndex = orderedNodes.findIndex((n) => n.id === currentId);
  const current = orderedNodes[currentIndex] ?? nodes.find((n) => n.id === currentId);
  const isPanorama = current?.media_type === "equirectangular";

  const { transform: depthTransform, depthActive, reducedMotion, lowPowerBlocked } = useImageDepthParallax(
    depthView && !isPanorama && !embedded,
    stageRef,
  );

  const currentHotspots = useMemo(
    () => hotspots.filter((h) => h.from_node_id === currentId && h.to_node_id),
    [hotspots, currentId],
  );
  const currentAnnotations = useMemo(
    () => annotations.filter((a) => a.node_id === currentId),
    [annotations, currentId],
  );

  useEffect(() => {
    if (!preview) onEvent?.("image_walkthrough_started", { nodeId: currentId });
  }, [preview, onEvent, currentId]);

  useEffect(() => {
    startRef.current = Date.now();
    onEvent?.("node_viewed", { nodeId: currentId, roomType: current?.room_type });
    return () => {
      const seconds = Math.round((Date.now() - startRef.current) / 1000);
      onEvent?.("time_spent_on_node", { nodeId: currentId, seconds });
    };
  }, [currentId, current?.room_type, onEvent]);

  const navigateTo = useCallback((targetId: string, via?: string) => {
    if (!targetId || targetId === currentId) return;
    setActiveAnn(null);
    setShowHint(false);
    setTransitioning(true);
    setTimeout(() => {
      setHistory((h) => [...h, currentId!]);
      setCurrentId(targetId);
      setTransitioning(false);
      onEvent?.("hotspot_clicked", { fromNodeId: currentId, toNodeId: targetId, via });
    }, 220);
  }, [currentId, onEvent]);

  const goPrevious = useCallback(() => {
    setShowHint(false);
    const prevHistory = history[history.length - 1];
    if (prevHistory) {
      setHistory((h) => h.slice(0, -1));
      setCurrentId(prevHistory);
      onEvent?.("hotspot_clicked", { fromNodeId: currentId, toNodeId: prevHistory, via: "back" });
      return;
    }
    if (currentIndex > 0) {
      setCurrentId(orderedNodes[currentIndex - 1].id);
      onEvent?.("hotspot_clicked", { fromNodeId: currentId, toNodeId: orderedNodes[currentIndex - 1].id, via: "keyboard" });
    }
  }, [history, currentIndex, orderedNodes, currentId, onEvent]);

  const goNext = useCallback(() => {
    setShowHint(false);
    if (currentIndex >= 0 && currentIndex < orderedNodes.length - 1) {
      navigateTo(orderedNodes[currentIndex + 1].id, "keyboard");
    }
  }, [currentIndex, orderedNodes, navigateTo]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA") return;
      const cmd = resolveKeyboardCommand(e.key, true);
      if (!cmd) return;
      e.preventDefault();
      if (cmd.type === "MOVE_FORWARD" || cmd.type === "NEXT_SCENE") goNext();
      else if (cmd.type === "MOVE_BACKWARD" || cmd.type === "PREVIOUS_SCENE") goPrevious();
      onEvent?.("keyboard_used", { key: e.key });
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [goNext, goPrevious, onEvent]);

  useEffect(() => {
    const onFs = () => setIsFullscreen(Boolean(document.fullscreenElement));
    document.addEventListener("fullscreenchange", onFs);
    return () => document.removeEventListener("fullscreenchange", onFs);
  }, []);

  useEffect(() => {
    setActiveAnn(null);
  }, [currentId]);

  useEffect(() => {
    if (!activeAnn) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setActiveAnn(null);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [activeAnn]);

  function toggleAnnotation(a: ImageWalkthroughAnnotation) {
    if (activeAnn?.id === a.id) {
      setActiveAnn(null);
      return;
    }
    setActiveAnn(a);
    onEvent?.("annotation_clicked", { annotationId: a.id, title: a.title });
  }

  function popoverPlacement(a: ImageWalkthroughAnnotation) {
    const parts: string[] = [];
    if (a.x_position > 0.62) parts.push("iw-ann-popover--left");
    else if (a.x_position < 0.28) parts.push("iw-ann-popover--right");
    if (a.y_position < 0.22) parts.push("iw-ann-popover--below");
    else if (a.y_position > 0.72) parts.push("iw-ann-popover--above");
    return parts.join(" ");
  }

  async function toggleFullscreen() {
    const el = rootRef.current ?? document.documentElement;
    if (!document.fullscreenElement) {
      await el.requestFullscreen().catch(() => {});
    } else {
      await document.exitFullscreen().catch(() => {});
    }
  }

  async function sendAiQuestion() {
    if (!aiInput.trim() || aiLoading || !propertyId || !organizationId) return;
    const query = aiInput.trim();
    setAiInput("");
    setAiMessages((m) => [...m, { role: "user", content: query }]);
    setAiLoading(true);
    onEvent?.("ai_question_asked", { query, nodeId: currentId });
    try {
      const res = await fetch("/api/ai/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          organizationId,
          propertyId,
          sessionId: sessionId ?? undefined,
          query,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed");
      setAiMessages((m) => [...m, { role: "assistant", content: data.answer ?? "No answer available." }]);
    } catch (e) {
      setAiMessages((m) => [...m, { role: "assistant", content: e instanceof Error ? e.message : "Something went wrong." }]);
    } finally {
      setAiLoading(false);
    }
  }

  if (!current) {
    return <div className="iw-viewer-empty">No images in this walkthrough.</div>;
  }

  const displayImageUrl = getNodeDisplayImageUrl(current);
  const canGoBack = history.length > 0 || currentIndex > 0;
  const canGoNext = currentIndex >= 0 && currentIndex < orderedNodes.length - 1;

  return (
    <div
      ref={rootRef}
      className={`iw-viewer-shell relative w-full bg-black ${embedded ? "h-full min-h-[360px]" : "h-[100dvh]"}`}
    >
      {/* Full-bleed image stage */}
      <div
        ref={stageRef}
        className={`iw-viewer-stage absolute inset-0 overflow-hidden ${transitioning ? "iw-viewer-stage--out" : ""}`}
      >
        {activeAnn && (
          <button
            type="button"
            className="iw-ann-backdrop"
            onClick={() => setActiveAnn(null)}
            aria-label="Close annotation"
          />
        )}
        <div
          className={`iw-depth-layer absolute inset-0 ${depthActive ? "iw-depth-layer--active" : ""}`}
          style={
            depthActive
              ? {
                  transform: `translate3d(${depthTransform.x}px, ${depthTransform.y}px, 0) scale(${depthTransform.scale})`,
                }
              : undefined
          }
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={displayImageUrl}
            alt={current.display_name ?? "Room"}
            className={`h-full w-full ${fitMode === "contain" ? "object-contain" : "object-cover"}`}
            draggable={false}
          />
          {!isPanorama && currentHotspots.map((h) => (
          <button
            key={h.id}
            type="button"
            className="iw-hotspot-marker"
            style={{ left: `${h.x_position * 100}%`, top: `${h.y_position * 100}%` }}
            onClick={() => h.to_node_id && navigateTo(h.to_node_id, "hotspot")}
            aria-label={h.label}
            title={h.label}
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        ))}
        {currentAnnotations.map((a) => (
          <div
            key={a.id}
            className="iw-ann-wrap"
            style={{ left: `${a.x_position * 100}%`, top: `${a.y_position * 100}%` }}
          >
            <button
              type="button"
              className={`iw-ann-marker ${activeAnn?.id === a.id ? "iw-ann-marker--active" : ""}`}
              onClick={(e) => {
                e.stopPropagation();
                toggleAnnotation(a);
              }}
              aria-label={a.title}
              aria-expanded={activeAnn?.id === a.id}
            />
            {activeAnn?.id === a.id && (
              <div
                className={`iw-ann-popover ${popoverPlacement(a)}`}
                role="dialog"
                aria-label={a.title}
                onClick={(e) => e.stopPropagation()}
              >
                <div className="iw-ann-popover-header">
                  <p className="iw-ann-popover-title">{a.title}</p>
                  <button
                    type="button"
                    className="iw-ann-popover-close"
                    onClick={() => setActiveAnn(null)}
                    aria-label="Close"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>
                {a.description && (
                  <p className="iw-ann-popover-body">{a.description}</p>
                )}
              </div>
            )}
          </div>
        ))}
        </div>
      </div>

      {/* Minimal header */}
      <div className="wt-viewer-header">
        <div className="min-w-0">
          <p className="wt-viewer-subtitle truncate">{propertyName ?? "Property tour"}</p>
          <p className="wt-viewer-title truncate">{current.display_name ?? "Room"}</p>
        </div>
        <p className="shrink-0 text-xs font-medium text-white/80">
          {Math.max(0, currentIndex) + 1}/{orderedNodes.length}
        </p>
      </div>

      {/* Room chips — horizontal strip, not a full sheet */}
      <div className={`wt-room-strip ${showRoomMenu ? "wt-room-strip--expanded" : ""}`}>
        {showRoomMenu && (
          <div className="wt-room-menu-header">
            <p>Jump to a room</p>
            <button type="button" className="wt-room-menu-close" onClick={() => setShowRoomMenu(false)} aria-label="Close">
              <X className="h-4 w-4" />
            </button>
          </div>
        )}
        {orderedNodes.map((n) => (
          <button
            key={n.id}
            type="button"
            className={`wt-room-chip ${n.id === currentId ? "wt-room-chip--active" : ""}`}
            onClick={() => {
              navigateTo(n.id, "list");
              setShowRoomMenu(false);
            }}
          >
            {n.display_name}
          </button>
        ))}
      </div>

      {/* Compact caption above dock */}
      <div className="wt-scroll-section-caption">
        <h2>{current.display_name}</h2>
        {current.description && (
          <p className="line-clamp-2">{current.description}</p>
        )}
      </div>

      {showHint && currentIndex === 0 && !embedded && (
        <div className="wt-scroll-hint">
          <ChevronDown className="h-5 w-5" />
          <span>Use arrow keys or A/D to move · click hotspots to jump rooms</span>
        </div>
      )}

      {/* Bottom dock — same pattern as video walkthrough */}
      <div className="wt-viewer-dock">
        <div className="wt-viewer-fit-row">
          <button
            type="button"
            className={`wt-viewer-fit-btn ${fitMode === "contain" ? "wt-viewer-fit-btn--active" : ""}`}
            onClick={() => setFitMode("contain")}
          >
            Fit to Screen
          </button>
          <button
            type="button"
            className={`wt-viewer-fit-btn ${fitMode === "cover" ? "wt-viewer-fit-btn--active" : ""}`}
            onClick={() => setFitMode("cover")}
          >
            Fill Screen
          </button>
          <button type="button" className="wt-viewer-fit-btn" onClick={toggleFullscreen}>
            {isFullscreen ? <Minimize2 className="h-3.5 w-3.5" /> : <Maximize2 className="h-3.5 w-3.5" />}
            {isFullscreen ? "Exit" : "Fullscreen"}
          </button>
          {!isPanorama && !embedded && (
            <button
              type="button"
              className={`wt-viewer-fit-btn ${depthView && depthActive ? "wt-viewer-fit-btn--active" : ""}`}
              onClick={() => {
                setDepthView((v) => !v);
                onEvent?.("depth_view_toggled", { enabled: !depthView });
              }}
              title={reducedMotion ? "Reduced motion is on" : lowPowerBlocked ? "Depth view unavailable on this device" : "Toggle depth parallax"}
            >
              <Layers className="h-3.5 w-3.5" />
              Depth View
            </button>
          )}
        </div>

        <div className="wt-viewer-progress">
          {orderedNodes.map((n, i) => (
            <button
              key={n.id}
              type="button"
              className="wt-viewer-dot"
              data-active={i === currentIndex}
              onClick={() => navigateTo(n.id, "dot")}
              aria-label={`Go to ${n.display_name}`}
            />
          ))}
        </div>

        <div className="wt-viewer-controls">
          <button
            type="button"
            className="wt-viewer-btn"
            onClick={goPrevious}
            disabled={!canGoBack}
            aria-label="Previous room"
          >
            <ChevronLeft className="h-5 w-5" />
          </button>
          <button
            type="button"
            className="wt-viewer-btn"
            onClick={() => setShowRoomMenu((v) => !v)}
            aria-label="Room menu"
          >
            <LayoutGrid className="h-5 w-5" />
          </button>
          {!preview && propertyId && organizationId && (
            <button
              type="button"
              className="wt-viewer-btn wt-viewer-btn--primary"
              onClick={() => setShowAI(true)}
              aria-label="Ask AI"
            >
              <MessageCircle className="h-5 w-5" />
            </button>
          )}
          <button
            type="button"
            className="wt-viewer-btn"
            onClick={goNext}
            disabled={!canGoNext}
            aria-label="Next room"
          >
            <ChevronRight className="h-5 w-5" />
          </button>
        </div>
      </div>

      {showAI && (
        <div className="wt-sheet">
          <div className="wt-sheet-handle" />
          <div className="wt-sheet-header">
            <span className="font-semibold">Ask about this property</span>
            <button type="button" className="rounded-full p-2" onClick={() => setShowAI(false)} aria-label="Close">
              <X className="h-5 w-5" />
            </button>
          </div>
          <div className="wt-sheet-body p-4">
            <div className="max-h-48 overflow-y-auto space-y-2 mb-3">
              {aiMessages.map((m, i) => (
                <p key={i} className={`text-sm ${m.role === "user" ? "text-right font-medium" : "text-muted-foreground"}`}>
                  {m.content}
                </p>
              ))}
            </div>
            <form
              className="flex gap-2"
              onSubmit={(e) => {
                e.preventDefault();
                sendAiQuestion();
              }}
            >
              <Input value={aiInput} onChange={(e) => setAiInput(e.target.value)} placeholder="Ask a question…" />
              <Button type="submit" size="icon" disabled={aiLoading}>
                {aiLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
              </Button>
            </form>
          </div>
        </div>
      )}

      {!preview && propertyId && !embedded && (
        <WalkthroughSiteVisitWidget propertyId={propertyId} sessionId={sessionId} propertyName={propertyName} />
      )}
    </div>
  );
}
