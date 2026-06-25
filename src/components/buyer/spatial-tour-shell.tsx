"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { PanoramaViewer } from "@/components/buyer/panorama-viewer";
import { AnnotationDetailSheet } from "@/components/buyer/annotation-detail-sheet";
import { isNavigationPin } from "@/lib/pins/pin-library";
import { normalizeAnnotations } from "@/types/annotations";
import type { SceneAnnotation } from "@/types/annotations";
import { ChevronLeft, ChevronRight, Map } from "lucide-react";

export interface TourScene {
  id: string;
  room_name: string;
  image_url: string;
  is_start_scene?: boolean;
  hotspots?: unknown[];
  initial_yaw?: number;
  initial_pitch?: number;
  panorama_config?: { haov?: number; vaov?: number; vOffset?: number; hfov?: number };
}

export interface FloorMapPin {
  id: string;
  name: string;
  x: number;
  y: number;
  sceneId?: string;
}

export interface TourCheckpoint {
  id: string;
  title: string;
  scene_id?: string;
  checkpoint_type?: string;
}

interface SpatialTourShellProps {
  scenes: TourScene[];
  currentSceneId: string | null;
  onSceneChange: (sceneId: string) => void;
  floorMap?: { image_url: string; pins: FloorMapPin[] };
  checkpoints?: TourCheckpoint[];
  projectName?: string;
  propertyName?: string;
  brandColor?: string;
  logoUrl?: string;
  onAnnotationClick?: (annotation: SceneAnnotation) => void;
  onViewChange?: (yaw: number, pitch: number) => void;
  onFloorMapPinClick?: (pinId: string, sceneId: string) => void;
  onCheckpointClick?: (checkpointId: string) => void;
  children?: React.ReactNode;
}

export function SpatialTourShell({
  scenes,
  currentSceneId,
  onSceneChange,
  floorMap,
  checkpoints = [],
  projectName,
  propertyName,
  brandColor,
  logoUrl,
  onAnnotationClick,
  onViewChange,
  onFloorMapPinClick,
  onCheckpointClick,
  children,
}: SpatialTourShellProps) {
  const [showScenePanel, setShowScenePanel] = useState(true);
  const [showFloorMap, setShowFloorMap] = useState(true);
  const [activeAnnotation, setActiveAnnotation] = useState<SceneAnnotation | null>(null);

  const scene = scenes.find((s) => s.id === currentSceneId);
  const sceneIndex = scenes.findIndex((s) => s.id === currentSceneId);
  const annotations = normalizeAnnotations((scene?.hotspots as SceneAnnotation[]) ?? []);

  function goToScene(delta: number) {
    const next = sceneIndex + delta;
    if (next >= 0 && next < scenes.length) onSceneChange(scenes[next].id);
  }

  function handleAnnotationClick(a: SceneAnnotation) {
    onAnnotationClick?.(a);
    if (a.targetSceneId && isNavigationPin(a.type)) {
      onSceneChange(a.targetSceneId);
    } else {
      setActiveAnnotation(a);
    }
  }

  return (
    <div className="relative h-full w-full bg-black text-white">
      {/* Panorama viewer — full bleed */}
      <div className="absolute inset-0">
        {scene ? (
          <PanoramaViewer
            imageUrl={scene.image_url}
            yaw={scene.initial_yaw ?? 0}
            pitch={scene.initial_pitch ?? 0}
            panoramaConfig={scene.panorama_config}
            annotations={annotations}
            onAnnotationClick={handleAnnotationClick}
            onViewChange={onViewChange}
          />
        ) : (
          <div className="flex h-full items-center justify-center text-white/60">
            Select a scene to begin
          </div>
        )}
      </div>

      {/* Top bar: branding + floor map strip */}
      <div
        className="absolute left-0 right-0 top-0 z-20 bg-gradient-to-b from-black/80 to-transparent"
        style={brandColor ? { borderBottom: `2px solid ${brandColor}` } : undefined}
      >
        <div className="flex items-start justify-between gap-2 px-3 pb-2 pt-3 sm:px-4">
          <div className="min-w-0 flex-1">
            {logoUrl && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={logoUrl} alt="Logo" className="mb-1 h-6 object-contain sm:h-8" />
            )}
            <p className="truncate text-[10px] uppercase tracking-wider text-white/60 sm:text-xs">{projectName}</p>
            <h1 className="truncate text-sm font-semibold sm:text-lg">{propertyName}</h1>
          </div>
          <div className="flex shrink-0 items-center gap-1">
            {floorMap && (
              <Button
                size="sm"
                variant={showFloorMap ? "secondary" : "ghost"}
                className="h-8 text-xs"
                onClick={() => setShowFloorMap(!showFloorMap)}
              >
                <Map className="mr-1 h-3.5 w-3.5" />
                Map
              </Button>
            )}
            <Button
              size="sm"
              variant={showScenePanel ? "secondary" : "ghost"}
              className="h-8 text-xs"
              onClick={() => setShowScenePanel(!showScenePanel)}
            >
              Scenes
            </Button>
          </div>
        </div>

        {/* Floor map — always visible at top when enabled */}
        {showFloorMap && floorMap && (
          <div className="mx-3 mb-2 rounded-lg border border-white/20 bg-black/60 p-2 backdrop-blur sm:mx-4">
            <div className="relative mx-auto aspect-[3/1] max-h-24 w-full max-w-2xl">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={floorMap.image_url} alt="Floor plan" className="h-full w-full object-contain" />
              {floorMap.pins.map((pin) => (
                <button
                  key={pin.id}
                  type="button"
                  title={pin.name}
                  className={`absolute flex h-4 w-4 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border-2 text-[8px] font-bold transition-transform hover:scale-125 ${
                    pin.sceneId === currentSceneId
                      ? "border-white bg-primary text-primary-foreground"
                      : "border-primary bg-primary/80 text-white"
                  }`}
                  style={{ left: `${pin.x}%`, top: `${pin.y}%` }}
                  onClick={() => {
                    if (pin.sceneId) {
                      onFloorMapPinClick?.(pin.id, pin.sceneId);
                      onSceneChange(pin.sceneId);
                    }
                  }}
                >
                  {scenes.findIndex((s) => s.id === pin.sceneId) + 1 || ""}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Scene navigation panel — left side */}
      {showScenePanel && (
        <div className="absolute bottom-20 left-0 top-32 z-20 w-44 sm:w-52">
          <div className="mx-2 flex h-full flex-col rounded-lg border border-white/20 bg-black/70 backdrop-blur">
            <div className="flex items-center justify-between border-b border-white/10 px-3 py-2">
              <p className="text-xs font-semibold">Scenes</p>
              <Badge variant="secondary" className="text-[10px]">
                {sceneIndex + 1}/{scenes.length}
              </Badge>
            </div>
            <ScrollArea className="flex-1">
              <div className="space-y-0.5 p-1">
                {scenes.map((s, i) => (
                  <button
                    key={s.id}
                    type="button"
                    onClick={() => onSceneChange(s.id)}
                    className={`flex w-full items-center gap-2 rounded-md px-2 py-2 text-left text-xs transition-colors ${
                      s.id === currentSceneId
                        ? "bg-primary text-primary-foreground"
                        : "text-white/80 hover:bg-white/10"
                    }`}
                  >
                    <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-white/10 text-[10px] font-bold">
                      {i + 1}
                    </span>
                    <span className="truncate">{s.room_name}</span>
                  </button>
                ))}
              </div>
            </ScrollArea>
            {/* Checkpoint shortcuts linked to scenes */}
            {checkpoints.filter((cp) => cp.scene_id).length > 0 && (
              <div className="border-t border-white/10 p-1">
                <p className="px-2 py-1 text-[10px] uppercase text-white/50">Checkpoints</p>
                {checkpoints
                  .filter((cp) => cp.scene_id)
                  .slice(0, 6)
                  .map((cp) => (
                    <button
                      key={cp.id}
                      type="button"
                      onClick={() => {
                        onCheckpointClick?.(cp.id);
                        if (cp.scene_id) onSceneChange(cp.scene_id);
                      }}
                      className="w-full truncate rounded px-2 py-1 text-left text-[11px] text-white/70 hover:bg-white/10"
                    >
                      {cp.title}
                    </button>
                  ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Prev / next scene arrows */}
      <div className="pointer-events-none absolute inset-y-0 left-44 right-0 z-10 flex items-center justify-between px-2 sm:left-52">
        <Button
          size="icon"
          variant="secondary"
          className="pointer-events-auto h-10 w-10 rounded-full opacity-80"
          disabled={sceneIndex <= 0}
          onClick={() => goToScene(-1)}
        >
          <ChevronLeft className="h-5 w-5" />
        </Button>
        <Button
          size="icon"
          variant="secondary"
          className="pointer-events-auto h-10 w-10 rounded-full opacity-80"
          disabled={sceneIndex >= scenes.length - 1}
          onClick={() => goToScene(1)}
        >
          <ChevronRight className="h-5 w-5" />
        </Button>
      </div>

      {/* Current scene label */}
      {scene && (
        <div className="pointer-events-none absolute bottom-24 left-1/2 z-10 -translate-x-1/2">
          <Badge className="bg-black/60 text-xs backdrop-blur">
            Scene {sceneIndex + 1}: {scene.room_name}
          </Badge>
        </div>
      )}

      {/* Overlay slot for AI, lead form, etc. */}
      {children}

      <AnnotationDetailSheet
        annotation={activeAnnotation}
        onClose={() => setActiveAnnotation(null)}
        onNavigate={(sceneId) => {
          onSceneChange(sceneId);
          setActiveAnnotation(null);
        }}
        onCta={() => setActiveAnnotation(null)}
      />
    </div>
  );
}
