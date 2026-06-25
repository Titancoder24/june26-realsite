"use client";

import { useCallback, useRef, useState } from "react";
import type { WalkthroughAnnotation, WalkthroughScene } from "@/types/cinematic-walkthrough";
import { Loader2, MapPin, Plus, Sparkles, Trash2 } from "lucide-react";
import { toast } from "sonner";

const ANNOTATION_CATEGORIES = [
  { value: "room_feature", label: "Room feature" },
  { value: "amenity", label: "Amenity" },
  { value: "material", label: "Material / finish" },
  { value: "view", label: "View" },
  { value: "pricing", label: "Pricing" },
  { value: "cta", label: "Call to action" },
  { value: "compliance", label: "Compliance" },
  { value: "meeting_room", label: "Meeting room" },
  { value: "loading_bay", label: "Loading bay" },
  { value: "parking", label: "Parking" },
];

const PIN_STYLES = [
  { value: "default", label: "Default" },
  { value: "feature", label: "Feature" },
  { value: "amenity", label: "Amenity" },
  { value: "cta", label: "CTA" },
  { value: "compliance", label: "Compliance" },
];

const ICON_TYPES = [
  { value: "pin", label: "Pin" },
  { value: "star", label: "Star" },
  { value: "info", label: "Info" },
  { value: "dollar", label: "Pricing" },
];

export function WalkthroughAnnotationEditor({
  scene,
  annotations,
  onAnnotationsChange,
}: {
  scene: WalkthroughScene;
  annotations: WalkthroughAnnotation[];
  onAnnotationsChange: (next: WalkthroughAnnotation[]) => void;
}) {
  const canvasRef = useRef<HTMLDivElement>(null);
  const [placing, setPlacing] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [aiText, setAiText] = useState("");
  const [aiSuggesting, setAiSuggesting] = useState(false);

  const selected = annotations.find((a) => a.id === selectedId) ?? null;
  const imageUrl = scene.edited_image_url || scene.image_url;

  const handleCanvasClick = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      if (!placing || !canvasRef.current) return;
      const rect = canvasRef.current.getBoundingClientRect();
      const x = (e.clientX - rect.left) / rect.width;
      const y = (e.clientY - rect.top) / rect.height;
      const id = crypto.randomUUID();
      const draft: WalkthroughAnnotation = {
        id,
        scene_id: scene.id,
        property_id: scene.property_id,
        experience_id: scene.experience_id,
        title: "New pin",
        category: "room_feature",
        pin_style: "default",
        icon_type: "pin",
        x_position: Math.min(1, Math.max(0, x)),
        y_position: Math.min(1, Math.max(0, y)),
        visibility: "public",
        rag_enabled: true,
        crm_tracking_enabled: true,
        sort_order: annotations.length,
      };
      onAnnotationsChange([...annotations, draft]);
      setSelectedId(id);
      setPlacing(false);
      toast.success("Pin placed — save to keep it");
    },
    [placing, scene, annotations, onAnnotationsChange],
  );

  function updateSelected(patch: Partial<WalkthroughAnnotation>) {
    if (!selectedId) return;
    onAnnotationsChange(annotations.map((a) => (a.id === selectedId ? { ...a, ...patch } : a)));
  }

  async function suggestFromText() {
    if (!selected || !aiText.trim()) return;
    setAiSuggesting(true);
    try {
      const res = await fetch("/api/walkthrough/annotations/suggest", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: aiText, sceneTitle: scene.title }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "AI suggestion failed");
      updateSelected({
        title: data.title,
        short_description: data.short_description,
        description: data.description,
        category: data.category,
        ai_context: data.ai_context,
      });
      setAiText("");
      toast.success("AI filled pin details — review and save");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "AI suggestion failed");
    } finally {
      setAiSuggesting(false);
    }
  }

  async function saveSelected() {
    if (!selected) return;
    setSaving(true);
    const isNew = !selected.created_at;
    const url = isNew
      ? `/api/walkthrough/scenes/${scene.id}/annotations`
      : `/api/walkthrough/scenes/${scene.id}/annotations/${selected.id}`;
    const res = await fetch(url, {
      method: isNew ? "POST" : "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: selected.title,
        short_description: selected.short_description,
        description: selected.description,
        category: selected.category,
        x_position: selected.x_position,
        y_position: selected.y_position,
        visibility: selected.visibility,
        cta_label: selected.cta_label,
        pin_style: selected.pin_style,
        icon_type: selected.icon_type,
        ai_context: selected.ai_context,
        rag_enabled: selected.rag_enabled,
        crm_tracking_enabled: selected.crm_tracking_enabled,
        sort_order: selected.sort_order,
      }),
    });
    setSaving(false);
    const saved = await res.json().catch(() => null);
    if (!res.ok) {
      return toast.error(typeof saved?.error === "string" ? saved.error : "Failed to save annotation");
    }
    onAnnotationsChange(annotations.map((a) => (a.id === selected.id ? saved : a)));
    setSelectedId(saved.id);
    toast.success(isNew ? "Pin added" : "Pin saved");
  }

  async function deleteSelected() {
    if (!selected) return;
    if (!selected.created_at) {
      onAnnotationsChange(annotations.filter((a) => a.id !== selectedId));
      setSelectedId(null);
      return;
    }
    const res = await fetch(`/api/walkthrough/scenes/${scene.id}/annotations/${selected.id}`, { method: "DELETE" });
    if (!res.ok) return toast.error("Failed to delete");
    onAnnotationsChange(annotations.filter((a) => a.id !== selectedId));
    setSelectedId(null);
    toast.success("Pin removed");
  }

  return (
    <div className="wt-annotation-editor">
      <div className="wt-annotation-canvas-wrap">
        <div className="wt-annotation-toolbar">
          <p className="text-sm font-medium">{scene.title}</p>
          <button
            type="button"
            className={`wt-annotation-add-btn ${placing ? "is-active" : ""}`}
            onClick={() => setPlacing((p) => !p)}
          >
            <Plus className="h-3.5 w-3.5" />
            {placing ? "Click on image…" : "Add pin"}
          </button>
        </div>
        <div
          ref={canvasRef}
          className={`wt-annotation-canvas ${placing ? "is-placing" : ""}`}
          onClick={handleCanvasClick}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={imageUrl} alt={scene.title} draggable={false} />
          {annotations.map((ann) => (
            <button
              key={ann.id}
              type="button"
              className="wt-annotation-pin"
              data-selected={selectedId === ann.id}
              data-style={ann.pin_style ?? "default"}
              style={{ left: `${ann.x_position * 100}%`, top: `${ann.y_position * 100}%` }}
              onClick={(e) => {
                e.stopPropagation();
                setSelectedId(ann.id);
                setPlacing(false);
              }}
            >
              <MapPin className="h-4 w-4" />
            </button>
          ))}
        </div>
      </div>

      <div className="wt-annotation-inspector">
        {selected ? (
          <div className="space-y-3">
            <div className="rounded-md border bg-muted/40 p-2">
              <label className="wt-field-label">Describe this pin (AI)</label>
              <textarea
                className="wt-input wt-textarea mt-1"
                rows={2}
                placeholder="e.g. Italian marble flooring — premium imported finish"
                value={aiText}
                onChange={(e) => setAiText(e.target.value)}
              />
              <button
                type="button"
                className="wt-btn-primary mt-2 w-full text-xs"
                onClick={suggestFromText}
                disabled={aiSuggesting || !aiText.trim()}
              >
                {aiSuggesting ? <Loader2 className="mr-1 inline h-3.5 w-3.5 animate-spin" /> : <Sparkles className="mr-1 inline h-3.5 w-3.5" />}
                {aiSuggesting ? "Generating…" : "AI fill pin details"}
              </button>
            </div>
            <div>
              <label className="wt-field-label">Title</label>
              <input className="wt-input" value={selected.title} onChange={(e) => updateSelected({ title: e.target.value })} />
            </div>
            <div>
              <label className="wt-field-label">Short description</label>
              <input className="wt-input" value={selected.short_description ?? ""} onChange={(e) => updateSelected({ short_description: e.target.value })} />
            </div>
            <div>
              <label className="wt-field-label">Details</label>
              <textarea className="wt-input wt-textarea" value={selected.description ?? ""} onChange={(e) => updateSelected({ description: e.target.value })} rows={3} />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="wt-field-label">Category</label>
                <select className="wt-input" value={selected.category} onChange={(e) => updateSelected({ category: e.target.value })}>
                  {ANNOTATION_CATEGORIES.map((c) => (
                    <option key={c.value} value={c.value}>{c.label}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="wt-field-label">Pin style</label>
                <select className="wt-input" value={selected.pin_style ?? "default"} onChange={(e) => updateSelected({ pin_style: e.target.value })}>
                  {PIN_STYLES.map((c) => (
                    <option key={c.value} value={c.value}>{c.label}</option>
                  ))}
                </select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="wt-field-label">Icon</label>
                <select className="wt-input" value={selected.icon_type ?? "pin"} onChange={(e) => updateSelected({ icon_type: e.target.value })}>
                  {ICON_TYPES.map((c) => (
                    <option key={c.value} value={c.value}>{c.label}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="wt-field-label">CTA label</label>
                <input className="wt-input" value={selected.cta_label ?? ""} onChange={(e) => updateSelected({ cta_label: e.target.value })} placeholder="Book visit" />
              </div>
            </div>
            <label className="flex items-center gap-2 text-xs text-muted-foreground">
              <input type="checkbox" checked={selected.rag_enabled} onChange={(e) => updateSelected({ rag_enabled: e.target.checked })} />
              Include in AI knowledge
            </label>
            <div className="flex gap-2">
              <button type="button" className="wt-btn-primary flex-1" onClick={saveSelected} disabled={saving}>
                {saving ? "Saving…" : "Save pin"}
              </button>
              <button type="button" className="wt-btn-ghost px-2" onClick={deleteSelected} aria-label="Delete pin">
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">
            Select a pin on the image or add a new one. Use AI describe to auto-fill title, category, and knowledge context.
          </p>
        )}
      </div>
    </div>
  );
}
