"use client";

import { MediaUpload } from "@/components/shared/media-upload";
import type { PropertyScene, SceneEditConfig } from "@/types/scene-intelligence";

function editStyle(edit: SceneEditConfig) {
  const filters = [
    edit.brightness != null ? `brightness(${edit.brightness}%)` : null,
    edit.contrast != null ? `contrast(${edit.contrast}%)` : null,
    edit.saturation != null ? `saturate(${edit.saturation}%)` : null,
  ].filter(Boolean).join(" ");
  return {
    filter: filters || undefined,
    transform: edit.rotation ? `rotate(${edit.rotation}deg)` : undefined,
  };
}

export function SceneEditorPanel({
  scene,
  propertyId,
  onChange,
  onSave,
  saving,
  variant = "default",
  canvasOnly = false,
  inspectorOnly = false,
}: {
  scene: PropertyScene;
  propertyId: string;
  onChange: (patch: Partial<PropertyScene>) => void;
  onSave: () => void;
  saving?: boolean;
  variant?: "default" | "studio";
  canvasOnly?: boolean;
  inspectorOnly?: boolean;
}) {
  const edit = scene.edit_config ?? {};
  const imageUrl = scene.edited_image_url || scene.image_url;
  const isStudio = variant === "studio";

  function updateEdit(patch: Partial<SceneEditConfig>) {
    onChange({ edit_config: { ...edit, ...patch } });
  }

  const canvas = (
    <div className={isStudio ? "studio-canvas-frame studio-canvas-zone" : "relative aspect-video overflow-hidden rounded-xl border bg-muted"}>
      {isStudio && <span className="studio-canvas-badge">{scene.title}</span>}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={imageUrl} alt={scene.title} className={isStudio ? "" : "h-full w-full object-cover"} style={editStyle(edit)} draggable={false} />
    </div>
  );

  const inspector = (
    <div className={isStudio ? "studio-panel-body space-y-4" : "space-y-4"}>
      {isStudio && (
        <div className="studio-panel-header -mx-[0.625rem] -mt-[0.625rem] mb-2">
          <h3>Properties</h3>
        </div>
      )}
      <div>
        <label className={isStudio ? "studio-field-label" : "mb-1 block text-sm"}>Scene title</label>
        <input
          className={isStudio ? "studio-input" : "w-full rounded-md border px-3 py-2 text-sm"}
          value={scene.title}
          onChange={(e) => onChange({ title: e.target.value })}
        />
      </div>
      <div>
        <label className={isStudio ? "studio-field-label" : "mb-1 block text-sm"}>Description</label>
        <textarea
          className={isStudio ? "studio-input studio-textarea" : "w-full rounded-md border px-3 py-2 text-sm"}
          value={scene.description ?? ""}
          onChange={(e) => onChange({ description: e.target.value })}
          placeholder="What does this scene show?"
          rows={2}
        />
      </div>
      <div>
        <label className={isStudio ? "studio-field-label" : "mb-1 block text-sm"}>AI context</label>
        <textarea
          className={isStudio ? "studio-input studio-textarea" : "w-full rounded-md border px-3 py-2 text-sm"}
          value={scene.ai_context ?? ""}
          onChange={(e) => onChange({ ai_context: e.target.value })}
          placeholder="Scene knowledge for buyer AI"
          rows={2}
        />
      </div>

      <div className="space-y-3">
        <div>
          <label className={isStudio ? "studio-field-label" : "text-xs"}>Brightness {edit.brightness ?? 100}%</label>
          <input type="range" min={50} max={150} value={edit.brightness ?? 100} onChange={(e) => updateEdit({ brightness: Number(e.target.value) })} className={isStudio ? "studio-range" : "w-full"} />
        </div>
        <div>
          <label className={isStudio ? "studio-field-label" : "text-xs"}>Contrast {edit.contrast ?? 100}%</label>
          <input type="range" min={50} max={150} value={edit.contrast ?? 100} onChange={(e) => updateEdit({ contrast: Number(e.target.value) })} className={isStudio ? "studio-range" : "w-full"} />
        </div>
        <div>
          <label className={isStudio ? "studio-field-label" : "text-xs"}>Rotation {edit.rotation ?? 0}°</label>
          <input type="range" min={-15} max={15} value={edit.rotation ?? 0} onChange={(e) => updateEdit({ rotation: Number(e.target.value) })} className={isStudio ? "studio-range" : "w-full"} />
        </div>
      </div>

      <div>
        <label className={isStudio ? "studio-field-label" : "mb-1 block text-sm"}>Replace image</label>
        <MediaUpload propertyId={propertyId} onUploaded={(a) => onChange({ image_url: a.file_url, edited_image_url: a.file_url, thumbnail_url: a.file_url })} />
      </div>

      <button type="button" onClick={onSave} disabled={saving} className={isStudio ? "studio-btn-primary w-full" : "rounded-md bg-primary px-4 py-2 text-sm text-primary-foreground disabled:opacity-50"}>
        {saving ? "Saving…" : "Save changes"}
      </button>
    </div>
  );

  if (canvasOnly) return canvas;
  if (inspectorOnly) return <div className="studio-panel flex flex-col min-h-0">{inspector}</div>;

  if (isStudio) {
    return (
      <div className="grid gap-4 lg:grid-cols-2 w-full">
        {canvas}
        {inspector}
      </div>
    );
  }

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      {canvas}
      {inspector}
    </div>
  );
}
