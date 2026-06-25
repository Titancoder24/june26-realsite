"use client";

import {
  forwardRef,
  useEffect,
  useId,
  useImperativeHandle,
  useRef,
  useMemo,
  useCallback,
} from "react";
import { createPannellumViewer } from "@/lib/pannellum/loader";
import { buildAnnotationHotspots } from "@/lib/pins/render-hotspot";
import type { PanoramaConfig } from "@/lib/capture/pannellum-stitch";
import { normalizeAnnotations } from "@/types/annotations";
import type { LegacyHotspot, SceneAnnotation } from "@/types/annotations";
import type { PannellumViewer } from "@/types/pannellum";

const DEFAULT_CONFIG: PanoramaConfig = {
  type: "equirectangular",
  haov: 360,
  vaov: 180,
  vOffset: 0,
  hfov: 100,
};

export interface PanoramaViewerHandle {
  getViewer: () => PannellumViewer | null;
  getYaw: () => number;
  getPitch: () => number;
  coordsFromEvent: (event: MouseEvent | TouchEvent) => { yaw: number; pitch: number } | null;
}

export const PanoramaViewer = forwardRef(function PanoramaViewer(
  {
    imageUrl,
    yaw = 0,
    pitch = 0,
    hfov,
    panoramaConfig,
    hotspots = [],
    annotations,
    onHotspotClick,
    onAnnotationClick,
    onViewChange,
    onPanoramaClick,
    debugHotspots = false,
    showControls = false,
    editMode = false,
    selectedAnnotationId = null,
  }: {
    imageUrl: string;
    yaw?: number;
    pitch?: number;
    hfov?: number;
    panoramaConfig?: Partial<PanoramaConfig>;
    hotspots?: LegacyHotspot[];
    annotations?: SceneAnnotation[];
    onHotspotClick?: (hotspot: LegacyHotspot) => void;
    onAnnotationClick?: (annotation: SceneAnnotation) => void;
    onViewChange?: (yaw: number, pitch: number) => void;
    onPanoramaClick?: (coords: { yaw: number; pitch: number }) => void;
    debugHotspots?: boolean;
    showControls?: boolean;
    editMode?: boolean;
    selectedAnnotationId?: string | null;
  },
  ref,
) {
  const containerRef = useRef<HTMLDivElement>(null);
  const viewerRef = useRef<PannellumViewer | null>(null);
  const onHotspotClickRef = useRef(onHotspotClick);
  const onAnnotationClickRef = useRef(onAnnotationClick);
  const onViewChangeRef = useRef(onViewChange);
  const onPanoramaClickRef = useRef(onPanoramaClick);
  const instanceId = useId().replace(/:/g, "");

  const resolvedAnnotations = useMemo(
    () => annotations ?? normalizeAnnotations(hotspots),
    [annotations, hotspots],
  );

  const cfg = useMemo(() => ({ ...DEFAULT_CONFIG, ...panoramaConfig }), [panoramaConfig]);
  const hotspotKey = useMemo(
    () =>
      JSON.stringify(
        resolvedAnnotations.map((h) => [h.id, h.type, h.yaw, h.pitch, h.label, h.targetSceneId, selectedAnnotationId, editMode]),
      ),
    [resolvedAnnotations, selectedAnnotationId, editMode],
  );

  useEffect(() => {
    onHotspotClickRef.current = onHotspotClick;
    onAnnotationClickRef.current = onAnnotationClick;
    onViewChangeRef.current = onViewChange;
    onPanoramaClickRef.current = onPanoramaClick;
  });

  const coordsFromEvent = useCallback((event: MouseEvent | TouchEvent): { yaw: number; pitch: number } | null => {
    const viewer = viewerRef.current;
    if (!viewer) return null;
    let clientX: number | undefined;
    let clientY: number | undefined;
    if ("touches" in event) {
      const touch = event.touches[0] ?? event.changedTouches[0];
      clientX = touch?.clientX;
      clientY = touch?.clientY;
    } else {
      clientX = event.clientX;
      clientY = event.clientY;
    }
    if (clientX == null || clientY == null) return null;
    const synthetic = new MouseEvent("click", { clientX, clientY, bubbles: true });
    return viewer.mouseEventToCoords(synthetic);
  }, []);

  useImperativeHandle(ref, () => ({
    getViewer: () => viewerRef.current,
    getYaw: () => viewerRef.current?.getYaw() ?? yaw,
    getPitch: () => viewerRef.current?.getPitch() ?? pitch,
    coordsFromEvent,
  }));

  useEffect(() => {
    const container = containerRef.current;
    if (!container || !imageUrl) return;

    let cancelled = false;
    let viewer: PannellumViewer | null = null;

    const handleAnnotationClick = (a: SceneAnnotation) => {
      onAnnotationClickRef.current?.(a);
      onHotspotClickRef.current?.(a);
    };

    (async () => {
      viewer = await createPannellumViewer(container, {
        type: "equirectangular",
        panorama: imageUrl,
        yaw,
        pitch,
        hfov: hfov ?? cfg.hfov,
        haov: cfg.haov,
        vaov: cfg.vaov,
        vOffset: cfg.vOffset,
        minHfov: 50,
        maxHfov: 120,
        showZoomCtrl: showControls,
        showFullscreenCtrl: showControls,
        keyboardZoom: showControls,
        mouseZoom: true,
        friction: 0.12,
        hotSpotDebug: debugHotspots,
        hotSpots: buildAnnotationHotspots(resolvedAnnotations, {
          onClick: handleAnnotationClick,
          editMode,
          selectedId: selectedAnnotationId,
        }),
        backgroundColor: [0, 0, 0],
      });

      if (cancelled) {
        viewer.destroy();
        return;
      }

      viewerRef.current = viewer;

      const reportView = () => {
        onViewChangeRef.current?.(viewer!.getYaw(), viewer!.getPitch());
      };

      viewer.on("mouseup", reportView);
      viewer.on("touchend", reportView);
      viewer.on("animatefinished", reportView);
    })();

    return () => {
      cancelled = true;
      viewer?.destroy();
      viewerRef.current = null;
    };
  }, [imageUrl, yaw, pitch, hfov, cfg, hotspotKey, debugHotspots, showControls, resolvedAnnotations, editMode, selectedAnnotationId]);

  const handlePointer = useCallback(
    (e: React.MouseEvent | React.TouchEvent) => {
      if (!editMode || !onPanoramaClickRef.current) return;
      const target = e.target as HTMLElement;
      if (target.closest(".pnlm-hotspot") || target.closest(".pnlm-pin")) return;
      const native = "touches" in e ? e.nativeEvent : e.nativeEvent;
      const coords = coordsFromEvent(native as MouseEvent);
      if (coords) onPanoramaClickRef.current(coords);
    },
    [editMode, coordsFromEvent],
  );

  return (
    <div className="relative h-full w-full">
      <div
        ref={containerRef}
        id={`pannellum-${instanceId}`}
        className={`pnlm-container h-full w-full${editMode ? " pnlm-edit-mode" : ""}`}
        onClick={editMode ? handlePointer : undefined}
        onTouchEnd={editMode ? handlePointer : undefined}
      />
      {editMode && (
        <div className="pointer-events-none absolute inset-x-0 top-3 flex justify-center">
          <span className="rounded-full bg-black/60 px-3 py-1 text-xs font-medium text-white backdrop-blur-sm">
            Tap on the scene to place a pin
          </span>
        </div>
      )}
    </div>
  );
});
