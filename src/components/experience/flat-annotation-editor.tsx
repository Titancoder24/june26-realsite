"use client";

import { useCallback, useRef, useState } from "react";
import { ANNOTATION_CATEGORIES, type PropertyScene, type SceneAnnotationRecord } from "@/types/scene-intelligence";
import { MapPin, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";

export function FlatAnnotationEditor({
  scene,
  annotations,
  onAnnotationsChange,
  variant = "default",
  canvasOnly = false,
  inspectorOnly = false,
}: {
  scene: PropertyScene;
  annotations: SceneAnnotationRecord[];
  onAnnotationsChange: (next: SceneAnnotationRecord[]) => void;
  variant?: "default" | "studio";
  canvasOnly?: boolean;
  inspectorOnly?: boolean;
}) {
  const canvasRef = useRef<HTMLDivElement>(null);
  const [placing, setPlacing] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const isStudio = variant === "studio";

  const selected = annotations.find((a) => a.id === selectedId) ?? null;
  const imageUrl = scene.edited_image_url || scene.image_url;

  const handleCanvasClick = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      if (!placing || !canvasRef.current) return;
      const rect = canvasRef.current.getBoundingClientRect();
      const x = (e.clientX - rect.left) / rect.width;
      const y = (e.clientY - rect.top) / rect.height;
      const id = crypto.randomUUID();
      const draft: SceneAnnotationRecord = {
        id,
        scene_id: scene.id,
        property_id: scene.property_id,
        experience_id: scene.experience_id,
        title: "New pin",
        category: "room_feature",
        x_position: Math.min(1, Math.max(0, x)),
        y_position: Math.min(1, Math.max(0, y)),
        visibility: "public",
        rag_enabled: true,
        crm_tracking_enabled: true,
      };
      onAnnotationsChange([...annotations, draft]);
      setSelectedId(id);
      setPlacing(false);
      toast.success("Pin placed");
    },
    [placing, scene, annotations, onAnnotationsChange],
  );

  function updateSelected(patch: Partial<SceneAnnotationRecord>) {
    if (!selectedId) return;
    onAnnotationsChange(annotations.map((a) => (a.id === selectedId ? { ...a, ...patch } : a)));
  }

  async function saveSelected() {
    if (!selected) return;
    setSaving(true);
    const isNew = !selected.created_at;
    const url = isNew
      ? `/api/property-scenes/${scene.id}/annotations`
      : `/api/property-scenes/${scene.id}/annotations/${selected.id}`;
    const res = await fetch(url, {
      method: isNew ? "POST" : "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(selected),
    });
    setSaving(false);
    if (!res.ok) return toast.error("Failed to save annotation");
    const saved = await res.json();
    onAnnotationsChange(annotations.map((a) => (a.id === selected.id ? saved : a)));
    setSelectedId(saved.id);
    toast.success("Saved to knowledge base");
  }

  async function deleteSelected() {
    if (!selected?.created_at) {
      onAnnotationsChange(annotations.filter((a) => a.id !== selectedId));
      setSelectedId(null);
      return;
    }
    const res = await fetch(`/api/property-scenes/${scene.id}/annotations/${selected.id}`, { method: "DELETE" });
    if (!res.ok) return toast.error("Failed to delete");
    onAnnotationsChange(annotations.filter((a) => a.id !== selected.id));
    setSelectedId(null);
    toast.success("Pin removed");
  }

  const canvas = (
    <div
      ref={canvasRef}
      className={
        isStudio
          ? "studio-canvas-frame studio-canvas-zone relative inline-block"
          : `relative aspect-video overflow-hidden rounded-xl bg-black ${placing ? "ring-2 ring-primary" : ""}`
      }
      data-placing={placing}
      data-cursor={placing ? "crosshair" : undefined}
      onClick={handleCanvasClick}
    >
      {isStudio && <span className="studio-canvas-badge">Pin mode · {scene.title}</span>}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={imageUrl} alt={scene.title} className={isStudio ? "" : "h-full w-full object-cover"} draggable={false} />
      {annotations.map((ann) => (
        <button
          key={ann.id}
          type="button"
          className={isStudio ? "studio-pin" : "absolute z-10 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 bg-white/90 p-1 shadow-lg"}
          data-selected={selectedId === ann.id}
          style={{ left: `${ann.x_position * 100}%`, top: `${ann.y_position * 100}%` }}
          onClick={(e) => { e.stopPropagation(); setSelectedId(ann.id); setPlacing(false); }}
        >
          <MapPin className={isStudio ? "" : "h-4 w-4 text-primary"} />
        </button>
      ))}
    </div>
  );

  const toolbar = isStudio && !inspectorOnly && (
    <div className="absolute top-4 right-4 z-20">
      <button
        type="button"
        className={placing ? "studio-btn-primary" : "studio-btn-ghost bg-white/95 backdrop-blur"}
        onClick={() => setPlacing((p) => !p)}
      >
        <Plus className="inline h-3.5 w-3.5 mr-1" />
        {placing ? "Click object…" : "Add pin"}
      </button>
    </div>
  );

  const inspector = (
    <div className={isStudio ? "studio-panel-body space-y-3" : "flex flex-col gap-3 overflow-y-auto"}>
      {isStudio && (
        <div className="studio-panel-header -mx-[0.625rem] -mt-[0.625rem] mb-2 flex items-center justify-between">
          <h3>Pin details</h3>
          {!inspectorOnly && (
            <button type="button" className={placing ? "studio-btn-primary text-[0.6875rem] py-1 px-2" : "studio-btn-ghost text-[0.6875rem] py-1 px-2"} onClick={() => setPlacing((p) => !p)}>
              <Plus className="inline h-3 w-3 mr-0.5" />
              {placing ? "Placing…" : "Add"}
            </button>
          )}
        </div>
      )}

      {selected ? (
        <>
          <div>
            <label className={isStudio ? "studio-field-label" : "text-sm font-medium"}>Title</label>
            <input className={isStudio ? "studio-input" : "w-full rounded-md border px-3 py-2 text-sm"} value={selected.title} onChange={(e) => updateSelected({ title: e.target.value })} />
          </div>
          <div>
            <label className={isStudio ? "studio-field-label" : "text-sm font-medium"}>Short description</label>
            <input className={isStudio ? "studio-input" : "w-full rounded-md border px-3 py-2 text-sm"} value={selected.short_description ?? ""} onChange={(e) => updateSelected({ short_description: e.target.value })} />
          </div>
          <div>
            <label className={isStudio ? "studio-field-label" : "text-sm font-medium"}>Details</label>
            <textarea className={isStudio ? "studio-input studio-textarea" : "w-full rounded-md border px-3 py-2 text-sm"} value={selected.description ?? ""} onChange={(e) => updateSelected({ description: e.target.value })} rows={3} />
          </div>
          <div>
            <label className={isStudio ? "studio-field-label" : "text-sm font-medium"}>Category</label>
            <select
              className={isStudio ? "studio-input" : "w-full rounded-md border px-3 py-2 text-sm"}
              value={selected.category}
              onChange={(e) => updateSelected({ category: e.target.value as SceneAnnotationRecord["category"] })}
            >
              {ANNOTATION_CATEGORIES.map((c) => (
                <option key={c.value} value={c.value}>{c.label}</option>
              ))}
            </select>
          </div>
          <label className="flex items-center gap-2 text-[0.75rem] text-[var(--studio-muted,#71717a)]">
            <input type="checkbox" checked={selected.rag_enabled} onChange={(e) => updateSelected({ rag_enabled: e.target.checked })} />
            Include in AI knowledge
          </label>
          <label className="flex items-center gap-2 text-[0.75rem] text-[var(--studio-muted,#71717a)]">
            <input type="checkbox" checked={selected.visibility === "public"} onChange={(e) => updateSelected({ visibility: e.target.checked ? "public" : "internal" })} />
            Visible to buyers
          </label>
          <div className="flex gap-2 pt-1">
            <button type="button" className={isStudio ? "studio-btn-primary flex-1" : "flex-1 rounded-md bg-primary px-3 py-2 text-sm text-white"} onClick={saveSelected} disabled={saving}>
              {saving ? "Saving…" : "Save pin"}
            </button>
            <button type="button" className="studio-btn-ghost px-2" onClick={deleteSelected} aria-label="Delete pin">
              <Trash2 className="h-4 w-4" />
            </button>
          </div>
        </>
      ) : (
        <div className="text-[0.75rem] text-[var(--studio-muted,#71717a)]">
          <p className="mb-3">Select a pin or add one on the canvas.</p>
          <div className="space-y-1">
            {annotations.map((a) => (
              <button key={a.id} type="button" className="studio-scene-item w-full" data-active={false} onClick={() => setSelectedId(a.id)}>
                <MapPin className="h-3.5 w-3.5 shrink-0 text-[var(--studio-accent,#0d99ff)]" />
                <div className="studio-scene-meta">
                  <strong>{a.title}</strong>
                  {!a.created_at && <small>Draft</small>}
                </div>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );

  if (canvasOnly) {
    return (
      <div className="relative">
        {toolbar}
        {canvas}
      </div>
    );
  }
  if (inspectorOnly) return <div className="studio-panel flex flex-col min-h-0">{inspector}</div>;

  if (isStudio) {
    return (
      <div className="grid flex-1 gap-4 overflow-hidden lg:grid-cols-[1fr_280px]">
        <div className="relative">{toolbar}{canvas}</div>
        {inspector}
      </div>
    );
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-hidden rounded-xl border bg-background">
      <div className="flex items-center justify-between border-b px-4 py-2">
        <p className="text-sm font-medium">Object pins — {scene.title}</p>
        <button type="button" className="text-sm underline" onClick={() => setPlacing((p) => !p)}>
          {placing ? "Tap object…" : "Add pin"}
        </button>
      </div>
      <div className="grid flex-1 gap-4 p-4 lg:grid-cols-[1fr_280px]">
        {canvas}
        {inspector}
      </div>
    </div>
  );
}
