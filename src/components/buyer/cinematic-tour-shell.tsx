"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { MotionSceneViewer } from "@/components/buyer/motion-scene-viewer";
import type { PropertyScene, SceneAnnotationRecord } from "@/types/scene-intelligence";
import { ChevronLeft, ChevronRight, Pause, Play } from "lucide-react";

export function CinematicTourShell({
  scenes,
  currentSceneId,
  onSceneChange,
  projectName,
  propertyName,
  brandColor,
  logoUrl,
  onAnnotationClick,
  onSceneEvent,
}: {
  scenes: PropertyScene[];
  currentSceneId: string | null;
  onSceneChange: (id: string) => void;
  projectName: string;
  propertyName: string;
  brandColor?: string;
  logoUrl?: string;
  onAnnotationClick?: (ann: SceneAnnotationRecord) => void;
  onSceneEvent?: (type: string, payload?: Record<string, unknown>) => void;
}) {
  const [playing, setPlaying] = useState(true);
  const [sceneStarted, setSceneStarted] = useState(false);
  const currentIndex = scenes.findIndex((s) => s.id === currentSceneId);
  const current = scenes[currentIndex] ?? scenes[0];
  const annotations = (current?.scene_annotations ?? []) as SceneAnnotationRecord[];

  useEffect(() => {
    if (!current) return;
    if (!sceneStarted) {
      onSceneEvent?.("scene_started", { sceneId: current.id, title: current.title });
      setSceneStarted(true);
    }
  }, [current?.id, sceneStarted, onSceneEvent, current]);

  function goNext() {
    if (current) onSceneEvent?.("scene_completed", { sceneId: current.id });
    const next = scenes[(currentIndex + 1) % scenes.length];
    if (next) {
      setSceneStarted(false);
      onSceneChange(next.id);
    }
  }

  function goPrev() {
    if (current) onSceneEvent?.("scene_skipped", { sceneId: current.id });
    const prev = scenes[(currentIndex - 1 + scenes.length) % scenes.length];
    if (prev) {
      setSceneStarted(false);
      onSceneChange(prev.id);
    }
  }

  if (!current) {
    return <div className="flex h-full items-center justify-center text-white">No scenes published</div>;
  }

  return (
    <div className="relative h-full w-full">
      <div className="absolute left-0 right-0 top-0 z-30 flex items-center justify-between bg-gradient-to-b from-black/60 to-transparent p-4">
        <div className="flex items-center gap-3">
          {logoUrl && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={logoUrl} alt="" className="h-8 w-8 rounded-full object-cover" />
          )}
          <div>
            <p className="text-xs text-white/70">{projectName}</p>
            <p className="font-semibold text-white" style={brandColor ? { color: brandColor } : undefined}>{propertyName}</p>
          </div>
        </div>
        <p className="text-sm text-white/80">
          Scene {currentIndex + 1} / {scenes.length}
        </p>
      </div>

      <MotionSceneViewer
        key={current.id}
        scene={current}
        annotations={annotations}
        playing={playing}
        onAnnotationClick={(ann) => {
          onSceneEvent?.("annotation_clicked", { sceneId: current.id, annotationId: ann.id, title: ann.title, category: ann.category });
          onAnnotationClick?.(ann);
        }}
      />

      <div className="absolute bottom-20 left-0 right-0 z-30 flex items-center justify-center gap-3 px-4">
        <Button size="icon" variant="secondary" className="rounded-full" onClick={goPrev}>
          <ChevronLeft className="h-5 w-5" />
        </Button>
        <Button size="icon" variant="secondary" className="rounded-full" onClick={() => { setPlaying((p) => !p); onSceneEvent?.(playing ? "scene_paused" : "scene_replayed", { sceneId: current.id }); }}>
          {playing ? <Pause className="h-5 w-5" /> : <Play className="h-5 w-5" />}
        </Button>
        <Button size="icon" variant="secondary" className="rounded-full" onClick={goNext}>
          <ChevronRight className="h-5 w-5" />
        </Button>
      </div>

      <div className="absolute bottom-4 left-4 right-4 z-30 flex gap-1">
        {scenes.map((s, i) => (
          <button
            key={s.id}
            type="button"
            className={`h-1 flex-1 rounded-full transition-colors ${i === currentIndex ? "bg-white" : "bg-white/30"}`}
            onClick={() => { onSceneChange(s.id); setSceneStarted(false); }}
            aria-label={`Go to ${s.title}`}
          />
        ))}
      </div>
    </div>
  );
}
