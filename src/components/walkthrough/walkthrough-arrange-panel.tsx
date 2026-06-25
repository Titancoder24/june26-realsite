"use client";

import { useCallback, useRef, useState } from "react";
import type { WalkthroughScene } from "@/types/cinematic-walkthrough";
import {
  formatConfidence,
  getSceneClassification,
  roomTypeLabel,
} from "@/lib/walkthrough-scene-meta";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Eye, EyeOff, GripVertical, Pencil, X, Check } from "lucide-react";
import { toast } from "sonner";

export function WalkthroughArrangePanel({
  scenes,
  onScenesChange,
  onReorder,
}: {
  scenes: WalkthroughScene[];
  onScenesChange: (next: WalkthroughScene[]) => void;
  onReorder: (ordered: WalkthroughScene[]) => Promise<void>;
}) {
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState({ title: "", room_type: "" });

  const includedScenes = scenes.filter((s) => getSceneClassification(s).included !== false);
  const excludedScenes = scenes.filter((s) => getSceneClassification(s).included === false);

  const saveScenePatch = useCallback(async (sceneId: string, patch: Record<string, unknown>) => {
    const res = await fetch(`/api/walkthrough/scenes/${sceneId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(patch),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error ?? "Failed to update scene");
    return data as WalkthroughScene;
  }, []);

  const orderRef = useRef(includedScenes);
  orderRef.current = includedScenes;

  async function persistOrder(ordered: WalkthroughScene[]) {
    const included = ordered.filter((s) => getSceneClassification(s).included !== false);
    onScenesChange([...included, ...excludedScenes]);
    await onReorder(included);
  }

  function onDragStart(index: number) {
    setDragIndex(index);
  }

  function onDragOver(e: React.DragEvent, index: number) {
    e.preventDefault();
    if (dragIndex == null || dragIndex === index) return;
    const next = [...includedScenes];
    const [moved] = next.splice(dragIndex, 1);
    next.splice(index, 0, moved);
    setDragIndex(index);
    orderRef.current = next;
    onScenesChange([...next, ...excludedScenes]);
  }

  async function onDragEnd() {
    setDragIndex(null);
    await persistOrder(orderRef.current);
  }

  function startEdit(scene: WalkthroughScene) {
    setEditingId(scene.id);
    setEditDraft({ title: scene.title, room_type: scene.room_type ?? "unknown" });
  }

  async function saveEdit(scene: WalkthroughScene) {
    try {
      const meta = getSceneClassification(scene);
      const saved = await saveScenePatch(scene.id, {
        title: editDraft.title.trim() || scene.title,
        room_type: editDraft.room_type.trim() || scene.room_type,
        scene_status: meta.needs_review && editDraft.title.trim() ? "planned" : scene.scene_status,
        edit_config: {
          ...(scene.edit_config ?? {}),
          needs_review: false,
          classification_reason: "Manually reviewed and renamed.",
          classification_confidence: 1,
          included: meta.included !== false,
        },
      });
      onScenesChange(scenes.map((s) => (s.id === scene.id ? { ...s, ...saved } : s)));
      setEditingId(null);
      toast.success("Room updated");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Update failed");
    }
  }

  async function toggleInclude(scene: WalkthroughScene) {
    const meta = getSceneClassification(scene);
    const nextIncluded = meta.included === false;
    try {
      const saved = await saveScenePatch(scene.id, {
        scene_status: nextIncluded ? (meta.needs_review ? "needs_review" : "planned") : "excluded",
        edit_config: {
          ...(scene.edit_config ?? {}),
          included: nextIncluded,
        },
      });
      const updated = scenes.map((s) => (s.id === scene.id ? { ...s, ...saved } : s));
      onScenesChange(updated);
      if (nextIncluded) {
        await persistOrder(updated.filter((s) => getSceneClassification(s).included !== false));
      }
      toast.success(nextIncluded ? "Scene included in walkthrough" : "Scene excluded from walkthrough");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Update failed");
    }
  }

  function renderCard(scene: WalkthroughScene, index: number, draggable: boolean) {
    const meta = getSceneClassification(scene);
    const thumb = scene.video_url ?? scene.thumbnail_url ?? scene.poster_url ?? scene.image_url;
    const isEditing = editingId === scene.id;

    return (
      <div
        key={scene.id}
        className={`wt-arrange-card ${meta.included === false ? "wt-arrange-card--excluded" : ""} ${dragIndex === index && draggable ? "wt-arrange-card--dragging" : ""}`}
        draggable={draggable && !isEditing}
        onDragStart={() => draggable && onDragStart(index)}
        onDragOver={(e) => draggable && onDragOver(e, index)}
        onDragEnd={() => draggable && onDragEnd()}
      >
        <div className="wt-arrange-thumb">
          {scene.video_url ? (
            <video src={scene.video_url} muted playsInline preload="metadata" />
          ) : (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={thumb} alt={scene.title} />
          )}
        </div>

        <div className="wt-arrange-body">
          <div className="wt-arrange-row">
            {draggable && <GripVertical className="h-4 w-4 shrink-0 text-muted-foreground" />}
            <span className="wt-arrange-order">{index + 1}</span>
            {isEditing ? (
              <div className="flex flex-1 flex-col gap-2 sm:flex-row">
                <Input value={editDraft.title} onChange={(e) => setEditDraft((d) => ({ ...d, title: e.target.value }))} placeholder="Room name" />
                <Input value={editDraft.room_type} onChange={(e) => setEditDraft((d) => ({ ...d, room_type: e.target.value }))} placeholder="room_type" />
              </div>
            ) : (
              <div className="min-w-0 flex-1">
                <p className="truncate font-medium">{scene.title}</p>
                <p className="text-xs text-muted-foreground">{roomTypeLabel(scene.room_type)}</p>
              </div>
            )}
          </div>
          <div className="mt-1 flex flex-wrap items-center gap-2">
            <span className={`wt-arrange-badge ${meta.needs_review ? "wt-arrange-badge--warn" : "wt-arrange-badge--ok"}`}>
              {meta.needs_review ? "Needs Review" : formatConfidence(meta.classification_confidence)}
            </span>
            {meta.classification_reason && (
              <span className="text-xs text-muted-foreground line-clamp-1">{meta.classification_reason}</span>
            )}
          </div>
        </div>

        <div className="wt-arrange-actions">
          {isEditing ? (
            <>
              <Button size="sm" variant="ghost" onClick={() => saveEdit(scene)} aria-label="Save"><Check className="h-4 w-4" /></Button>
              <Button size="sm" variant="ghost" onClick={() => setEditingId(null)} aria-label="Cancel"><X className="h-4 w-4" /></Button>
            </>
          ) : (
            <>
              <Button size="sm" variant="ghost" onClick={() => startEdit(scene)} aria-label="Edit room"><Pencil className="h-4 w-4" /></Button>
              <Button size="sm" variant="ghost" onClick={() => toggleInclude(scene)} aria-label={meta.included === false ? "Include scene" : "Exclude scene"}>
                {meta.included === false ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </Button>
            </>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {includedScenes.length === 0 && (
        <p className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
          No included scenes — re-enable at least one scene to continue.
        </p>
      )}
      <div className="space-y-2">
        {includedScenes.map((scene, i) => renderCard(scene, i, true))}
      </div>
      {excludedScenes.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Excluded from walkthrough</p>
          {excludedScenes.map((scene, i) => renderCard(scene, i, false))}
        </div>
      )}
    </div>
  );
}
