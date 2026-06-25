"use client";

import { useCallback, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { PanoramaViewer, type PanoramaViewerHandle } from "@/components/buyer/panorama-viewer";
import { PinPicker } from "@/components/experience/pin-picker";
import {
  buildAutoAnnotations,
  describeAnnotation,
  suggestPinsForRoom,
  type AnnotationFlowStep,
} from "@/lib/annotations/annotation-agent";
import { getPin, isNavigationPin } from "@/lib/pins/pin-library";
import { normalizeAnnotations } from "@/types/annotations";
import type { SceneAnnotation } from "@/types/annotations";
import { Crosshair, MapPin, Sparkles, Trash2, Wand2 } from "lucide-react";
import { toast } from "sonner";

interface SceneInfo {
  id: string;
  room_name: string;
  image_url: string;
  panorama_config?: { haov?: number; vaov?: number; vOffset?: number; hfov?: number };
  hotspots?: SceneAnnotation[];
}

export function SpatialAnnotationEditor({
  scene,
  scenes,
  onSave,
}: {
  scene: SceneInfo;
  scenes: SceneInfo[];
  onSave: (annotations: SceneAnnotation[]) => void;
}) {
  const viewerRef = useRef<PanoramaViewerHandle>(null);
  const [annotations, setAnnotations] = useState<SceneAnnotation[]>(() =>
    normalizeAnnotations(scene.hotspots ?? []),
  );
  const [selectedType, setSelectedType] = useState("window");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [flowStep, setFlowStep] = useState<AnnotationFlowStep>("pick_pin");
  const [viewYaw, setViewYaw] = useState(0);
  const [viewPitch, setViewPitch] = useState(0);
  const [showPicker, setShowPicker] = useState(true);
  const [saving, setSaving] = useState(false);

  const selected = annotations.find((a) => a.id === selectedId) ?? null;
  const selectedPin = getPin(selected?.type ?? selectedType);

  const placeAtCenter = useCallback(() => {
    const yaw = viewerRef.current?.getYaw() ?? viewYaw;
    const pitch = viewerRef.current?.getPitch() ?? viewPitch;
    addAnnotation(yaw, pitch);
  }, [selectedType, viewYaw, viewPitch]);

  function addAnnotation(yaw: number, pitch: number) {
    const pin = getPin(selectedType);
    const id = crypto.randomUUID();
    const next: SceneAnnotation = {
      id,
      type: selectedType,
      label: pin.defaultLabel ?? pin.label,
      yaw,
      pitch,
      payload: { description: describeAnnotation(selectedType, scene.room_name) },
    };
    setAnnotations((prev) => [...prev, next]);
    setSelectedId(id);
    setFlowStep("edit");
    toast.success(`${pin.label} placed`);
  }

  function updateSelected(patch: Partial<SceneAnnotation>) {
    if (!selectedId) return;
    setAnnotations((prev) => prev.map((a) => (a.id === selectedId ? { ...a, ...patch } : a)));
  }

  function removeSelected() {
    if (!selectedId) return;
    setAnnotations((prev) => prev.filter((a) => a.id !== selectedId));
    setSelectedId(null);
    setFlowStep("pick_pin");
  }

  async function persist() {
    setSaving(true);
    const res = await fetch(`/api/scenes/${scene.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ hotspots: annotations }),
    });
    setSaving(false);
    if (!res.ok) return toast.error("Failed to save annotations");
    onSave(annotations);
    toast.success("Annotations saved");
  }

  function runAutoSuggest() {
    const result = buildAutoAnnotations(
      scenes.map((s) => ({ id: s.id, room_name: s.room_name })),
      { [scene.id]: annotations },
    );
    const batch = result.find((r) => r.sceneId === scene.id);
    if (batch) {
      setAnnotations(batch.annotations);
      toast.success("AI suggested pins added — drag view to reposition");
    }
  }

  const suggestions = suggestPinsForRoom(scene.room_name).slice(0, 5);

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-0 overflow-hidden rounded-xl border bg-background">
      {/* Panorama — primary canvas */}
      <div className="relative min-h-[42vh] flex-1 md:min-h-[50vh]">
        <PanoramaViewer
          ref={viewerRef}
          imageUrl={scene.image_url}
          yaw={viewYaw}
          pitch={viewPitch}
          panoramaConfig={scene.panorama_config}
          annotations={annotations}
          showControls
          editMode={flowStep === "place"}
          selectedAnnotationId={selectedId}
          onViewChange={(y, p) => { setViewYaw(y); setViewPitch(p); }}
          onPanoramaClick={(coords) => addAnnotation(coords.yaw, coords.pitch)}
          onAnnotationClick={(a) => {
            setSelectedId(a.id);
            setFlowStep("edit");
          }}
        />
      </div>

      {/* Mobile tool strip */}
      <div className="flex items-center gap-1 border-t bg-muted/30 px-2 py-2">
        {(["pick_pin", "place", "edit"] as AnnotationFlowStep[]).map((step) => (
          <Button
            key={step}
            size="sm"
            variant={flowStep === step ? "default" : "ghost"}
            className="h-9 flex-1 text-xs"
            onClick={() => {
              setFlowStep(step);
              if (step === "pick_pin") setShowPicker(true);
            }}
          >
            {step === "pick_pin" && "Pick"}
            {step === "place" && "Place"}
            {step === "edit" && "Edit"}
          </Button>
        ))}
        <Button size="sm" variant="outline" className="h-9 shrink-0 px-2" onClick={placeAtCenter} title="Place at center of view">
          <Crosshair className="h-4 w-4" />
        </Button>
        <Button size="sm" variant="outline" className="h-9 shrink-0 px-2" onClick={runAutoSuggest} title="AI suggest pins">
          <Wand2 className="h-4 w-4" />
        </Button>
      </div>

      {/* Bottom panel */}
      <div
        className="max-h-[48vh] overflow-y-auto border-t px-3 py-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))]"
        style={{ WebkitOverflowScrolling: "touch" }}
      >
        <div className="mb-3 flex items-center justify-between gap-2">
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold">{scene.room_name}</p>
            <p className="text-xs text-muted-foreground">{annotations.length} pins · {getPin(selectedType).label} selected</p>
          </div>
          <Badge variant="secondary">{annotations.length}</Badge>
        </div>

        {flowStep === "pick_pin" && showPicker && (
          <div className="space-y-3">
            <PinPicker selectedType={selectedType} onSelect={setSelectedType} compact />
            <div className="flex flex-wrap gap-1.5">
              {suggestions.map((s) => (
                <button
                  key={s.type}
                  type="button"
                  onClick={() => setSelectedType(s.type)}
                  className="inline-flex items-center gap-1 rounded-full border bg-background px-2.5 py-1 text-xs hover:bg-muted"
                >
                  <Sparkles className="h-3 w-3 text-primary" />
                  {s.label}
                </button>
              ))}
            </div>
            <Button className="w-full" onClick={() => setFlowStep("place")}>
              <MapPin className="mr-2 h-4 w-4" />
              Tap scene to place {getPin(selectedType).label}
            </Button>
          </div>
        )}

        {flowStep === "place" && (
          <p className="text-center text-sm text-muted-foreground">
            Tap the window, door, or feature in the panorama above — or use the crosshair to place at center of view.
          </p>
        )}

        {flowStep === "edit" && selected && (
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <span className="text-2xl">{selectedPin.icon}</span>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium">{selectedPin.label}</p>
                <p className="text-xs text-muted-foreground">yaw {selected.yaw.toFixed(1)}° · pitch {selected.pitch.toFixed(1)}°</p>
              </div>
              <Button size="icon" variant="ghost" className="text-destructive" onClick={removeSelected}>
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
            <Input
              placeholder="Label (e.g. Master bedroom window)"
              value={selected.label}
              onChange={(e) => updateSelected({ label: e.target.value })}
            />
            <Textarea
              placeholder="Description for buyers and AI agent"
              rows={3}
              value={selected.payload?.description ?? ""}
              onChange={(e) =>
                updateSelected({ payload: { ...selected.payload, description: e.target.value } })
              }
            />
            {isNavigationPin(selected.type) && (
              <select
                className="w-full rounded-md border px-3 py-2.5 text-sm"
                value={selected.targetSceneId ?? ""}
                onChange={(e) => updateSelected({ targetSceneId: e.target.value || undefined })}
              >
                <option value="">Link to room…</option>
                {scenes.filter((s) => s.id !== scene.id).map((s) => (
                  <option key={s.id} value={s.id}>{s.room_name}</option>
                ))}
              </select>
            )}
            <Input
              placeholder="Media URL (photo/video)"
              value={selected.payload?.mediaUrl ?? ""}
              onChange={(e) =>
                updateSelected({ payload: { ...selected.payload, mediaUrl: e.target.value } })
              }
            />
          </div>
        )}

        {/* Pin list */}
        {annotations.length > 0 && flowStep !== "edit" && (
          <div className="mt-3 space-y-1">
            {annotations.map((a) => {
              const pin = getPin(a.type);
              return (
                <button
                  key={a.id}
                  type="button"
                  onClick={() => { setSelectedId(a.id); setFlowStep("edit"); }}
                  className="flex w-full items-center gap-2 rounded-lg border px-3 py-2 text-left text-sm hover:bg-muted/50"
                >
                  <span>{pin.icon}</span>
                  <span className="min-w-0 flex-1 truncate">{a.label}</span>
                  <span className="text-xs text-muted-foreground">{pin.label}</span>
                </button>
              );
            })}
          </div>
        )}

        <Button className="mt-4 w-full" onClick={persist} disabled={saving}>
          {saving ? "Saving…" : `Save ${annotations.length} Annotations`}
        </Button>
      </div>
    </div>
  );
}
