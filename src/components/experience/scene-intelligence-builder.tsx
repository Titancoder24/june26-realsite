"use client";

import { useEffect, useState } from "react";
import { MediaUpload } from "@/components/shared/media-upload";
import { SceneEditorPanel } from "@/components/experience/scene-editor-panel";
import { SceneMotionPicker } from "@/components/experience/scene-motion-picker";
import { FlatAnnotationEditor } from "@/components/experience/flat-annotation-editor";
import type { MotionType, PropertyScene, SceneAnnotationRecord } from "@/types/scene-intelligence";
import { toPropertyScenePatch } from "@/lib/scene-intelligence/patch";
import { ExternalLink, Film, MapPin, Pencil, Sparkles } from "lucide-react";
import { toast } from "sonner";
import "@/styles/scene-studio.css";

type BuilderTab = "scenes" | "edit" | "motion" | "annotate";

export function SceneIntelligenceBuilder({ experienceId, propertyId }: { experienceId: string; propertyId: string }) {
  const [scenes, setScenes] = useState<PropertyScene[]>([]);
  const [selected, setSelected] = useState<PropertyScene | null>(null);
  const [sceneTitle, setSceneTitle] = useState("");
  const [tab, setTab] = useState<BuilderTab>("edit");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetch(`/api/property-scenes?experienceId=${experienceId}`)
      .then(async (r) => {
        const data = await r.json();
        if (!r.ok) throw new Error(data.error ?? "Failed to load scenes");
        return data as PropertyScene[];
      })
      .then((data) => {
        const list = Array.isArray(data) ? data : [];
        setScenes(list);
        setSelected((prev) => prev ?? list[0] ?? null);
      })
      .catch((e) => toast.error(e instanceof Error ? e.message : "Failed to load scenes"));
  }, [experienceId]);

  async function addScene(fileUrl: string) {
    const res = await fetch("/api/property-scenes", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        experience_id: experienceId,
        property_id: propertyId,
        title: sceneTitle || `Scene ${scenes.length + 1}`,
        image_url: fileUrl,
        thumbnail_url: fileUrl,
        is_start_scene: scenes.length === 0,
      }),
    });
    const data = await res.json();
    if (!res.ok) return toast.error(data.error);
    const scene = { ...data, scene_annotations: [] as SceneAnnotationRecord[] };
    setScenes((s) => [...s, scene]);
    setSelected(scene);
    setSceneTitle("");
    setTab("edit");
    toast.success("Scene added");
  }

  async function saveScene(patch: Partial<PropertyScene>) {
    if (!selected) return;
    const merged = { ...selected, ...patch };
    setSelected(merged);
    setScenes((s) => s.map((sc) => (sc.id === selected.id ? merged : sc)));
  }

  async function persistScene(patch: Partial<PropertyScene> = {}) {
    if (!selected) return;
    setSaving(true);
    const merged = { ...selected, ...patch };
    const body = toPropertyScenePatch(merged);
    const res = await fetch(`/api/property-scenes/${selected.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    setSaving(false);
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      return toast.error(err.error ?? "Failed to save scene");
    }
    const data = await res.json();
    const updated = { ...data, scene_annotations: selected.scene_annotations ?? [] };
    setSelected(updated);
    setScenes((s) => s.map((sc) => (sc.id === selected.id ? updated : sc)));
    toast.success("Saved");
  }

  async function setMotion(motionType: MotionType) {
    if (!selected) return;
    await persistScene({ motion_type: motionType });
  }

  async function setStartScene(id: string) {
    await fetch(`/api/property-scenes/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ is_start_scene: true }) });
    setScenes((s) => s.map((sc) => ({ ...sc, is_start_scene: sc.id === id })));
    toast.success("Start scene set");
  }

  async function publish() {
    const res = await fetch(`/api/experiences/${experienceId}/publish`, { method: "POST" });
    const data = await res.json();
    if (!res.ok) return toast.error(data.error);
    toast.success(`Published: ${data.publishedUrl}`);
  }

  const tabs: { id: BuilderTab; label: string; icon: typeof Film }[] = [
    { id: "edit", label: "Edit", icon: Pencil },
    { id: "motion", label: "Motion", icon: Sparkles },
    { id: "annotate", label: "Pins", icon: MapPin },
  ];

  const showInspector = tab === "edit" || tab === "annotate";

  return (
    <div className="scene-studio">
      <header className="studio-toolbar">
        <div className="studio-toolbar-brand">
          <div>
            <h2>Scene Studio</h2>
            <span>{selected ? selected.title : "No scene selected"}</span>
          </div>
          <nav className="studio-segmented" aria-label="Studio modes">
            {tabs.map((t) => {
              const Icon = t.icon;
              return (
                <button key={t.id} type="button" data-active={tab === t.id} onClick={() => setTab(t.id)}>
                  <Icon className="h-3.5 w-3.5" />
                  {t.label}
                </button>
              );
            })}
          </nav>
        </div>
        <div className="studio-toolbar-actions">
          <a href={`/view/${experienceId}?preview=1`} target="_blank" rel="noreferrer" className="studio-btn-ghost studio-clickable inline-flex items-center gap-1.5">
            <ExternalLink className="h-3.5 w-3.5" />
            Preview
          </a>
          <button type="button" className="studio-btn-primary" onClick={publish} disabled={!scenes.length}>
            Publish viewer
          </button>
        </div>
      </header>

      <div className="studio-workspace" data-has-inspector={showInspector && !!selected}>
        <aside className="studio-panel studio-panel-left">
          <div className="studio-panel-header">
            <h3>Scenes</h3>
          </div>
          <div className="studio-panel-body space-y-2">
            <div className="space-y-2 pb-2 border-b border-[var(--studio-border)]">
              <label className="studio-field-label">New scene title</label>
              <input
                className="studio-input"
                placeholder="Kitchen, Living room…"
                value={sceneTitle}
                onChange={(e) => setSceneTitle(e.target.value)}
              />
              <MediaUpload propertyId={propertyId} onUploaded={(a) => addScene(a.file_url)} />
            </div>

            {scenes.map((scene, i) => (
              <button
                key={scene.id}
                type="button"
                className="studio-scene-item"
                data-active={selected?.id === scene.id}
                onClick={() => { setSelected(scene); setTab("edit"); }}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={scene.thumbnail_url || scene.image_url} alt="" className="studio-scene-thumb" />
                <div className="studio-scene-meta">
                  <strong>{i + 1}. {scene.title}</strong>
                  <small>{scene.scene_annotations?.length ?? 0} pins · {scene.motion_type?.replace(/_/g, " ")}</small>
                  <div className="mt-1 flex flex-wrap gap-1">
                    {scene.is_start_scene && <span className="studio-tag studio-tag-accent">Start</span>}
                    {!scene.is_start_scene && (
                      <span
                        className="studio-tag studio-clickable"
                        role="button"
                        tabIndex={0}
                        onClick={(e) => { e.stopPropagation(); setStartScene(scene.id); }}
                        onKeyDown={(e) => { if (e.key === "Enter") { e.stopPropagation(); setStartScene(scene.id); } }}
                      >
                        Set start
                      </span>
                    )}
                  </div>
                </div>
              </button>
            ))}

            {!scenes.length && (
              <div className="studio-empty py-8">
                <strong>No scenes yet</strong>
                <p>Upload a property image to create your first cinematic scene.</p>
              </div>
            )}
          </div>
        </aside>

        <main className="studio-canvas-wrap min-h-0 flex-1">
          {!selected ? (
            <div className="studio-empty">
              <strong>Select or upload a scene</strong>
              <p>Use the left panel to add property images. Each image becomes an interactive motion scene.</p>
            </div>
          ) : tab === "edit" ? (
            <SceneEditorPanel
              scene={selected}
              propertyId={propertyId}
              onChange={saveScene}
              onSave={() => persistScene()}
              saving={saving}
              variant="studio"
              canvasOnly
            />
          ) : tab === "motion" ? (
            <div className="w-full max-w-3xl rounded-lg border border-[var(--studio-border)] bg-white p-4 shadow-sm">
              <p className="mb-3 text-[0.8125rem] font-semibold">Motion for {selected.title}</p>
              <SceneMotionPicker scene={selected} onSelect={setMotion} saving={saving} variant="studio" />
            </div>
          ) : (
            <FlatAnnotationEditor
              scene={selected}
              annotations={(selected.scene_annotations ?? []) as SceneAnnotationRecord[]}
              onAnnotationsChange={(next) => {
                const updated = { ...selected, scene_annotations: next };
                setSelected(updated);
                setScenes((s) => s.map((sc) => (sc.id === selected.id ? updated : sc)));
              }}
              variant="studio"
              canvasOnly
            />
          )}
        </main>

        {showInspector && selected && (
          <aside className="studio-panel studio-panel-right">
            {tab === "edit" ? (
              <SceneEditorPanel
                scene={selected}
                propertyId={propertyId}
                onChange={saveScene}
                onSave={() => persistScene()}
                saving={saving}
                variant="studio"
                inspectorOnly
              />
            ) : (
              <FlatAnnotationEditor
                scene={selected}
                annotations={(selected.scene_annotations ?? []) as SceneAnnotationRecord[]}
                onAnnotationsChange={(next) => {
                  const updated = { ...selected, scene_annotations: next };
                  setSelected(updated);
                  setScenes((s) => s.map((sc) => (sc.id === selected.id ? updated : sc)));
                }}
                variant="studio"
                inspectorOnly
              />
            )}
          </aside>
        )}
      </div>
    </div>
  );
}
