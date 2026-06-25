"use client";

import { MOTION_PRESETS, suggestMotionForScene, type MotionType, type PropertyScene } from "@/types/scene-intelligence";
import { Sparkles } from "lucide-react";

export function SceneMotionPicker({
  scene,
  onSelect,
  saving,
  variant = "default",
}: {
  scene: PropertyScene;
  onSelect: (motionType: MotionType) => void;
  saving?: boolean;
  variant?: "default" | "studio";
}) {
  const recommended = suggestMotionForScene(scene.title);
  const recommendedPreset = MOTION_PRESETS.find((p) => p.type === recommended);
  const isStudio = variant === "studio";

  if (isStudio) {
    return (
      <div className="space-y-3">
        <div className="studio-ai-hint">
          <Sparkles className="h-4 w-4 shrink-0 text-[var(--studio-accent)]" />
          <div className="min-w-0 flex-1">
            <p><strong>Recommended: {recommendedPreset?.label}</strong></p>
            <p className="text-[var(--studio-muted)]">{recommendedPreset?.description}</p>
          </div>
          <button type="button" className="studio-btn-primary shrink-0" disabled={saving} onClick={() => onSelect(recommended)}>
            Apply
          </button>
        </div>

        <div className="studio-motion-grid">
          {MOTION_PRESETS.map((preset) => (
            <button
              key={preset.type}
              type="button"
              disabled={saving}
              className="studio-motion-card"
              data-active={scene.motion_type === preset.type}
              onClick={() => onSelect(preset.type)}
            >
              <strong>{preset.label}</strong>
              <p>{preset.description}</p>
            </button>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 rounded-lg border border-primary/20 bg-primary/5 p-3">
        <Sparkles className="h-4 w-4 shrink-0 text-primary" />
        <div className="min-w-0">
          <p className="text-sm font-medium">AI recommends: {recommendedPreset?.label}</p>
          <p className="text-xs text-muted-foreground">{recommendedPreset?.description}</p>
        </div>
        <button type="button" className="shrink-0 rounded-md border px-3 py-1.5 text-sm" disabled={saving} onClick={() => onSelect(recommended)}>
          Apply
        </button>
      </div>

      <div className="grid gap-2 sm:grid-cols-2">
        {MOTION_PRESETS.map((preset) => {
          const active = scene.motion_type === preset.type;
          return (
            <button
              key={preset.type}
              type="button"
              disabled={saving}
              onClick={() => onSelect(preset.type)}
              className={`rounded-lg border p-3 text-left transition-colors hover:border-primary/50 ${active ? "border-primary bg-primary/5 ring-1 ring-primary/20" : ""}`}
            >
              <div className="flex items-center justify-between gap-2">
                <span className="text-sm font-medium">{preset.label}</span>
                {active && <span className="text-xs text-muted-foreground">Selected</span>}
              </div>
              <p className="mt-1 text-xs text-muted-foreground">{preset.description}</p>
            </button>
          );
        })}
      </div>
    </div>
  );
}
