"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { MediaUpload } from "@/components/shared/media-upload";
import { SpatialAnnotationEditor } from "@/components/experience/spatial-annotation-editor";
import { normalizeAnnotations } from "@/types/annotations";
import type { SceneAnnotation } from "@/types/annotations";
import { toast } from "sonner";

interface Scene {
  id: string;
  room_name: string;
  image_url: string;
  thumbnail_url?: string;
  initial_yaw?: number;
  initial_pitch?: number;
  is_start_scene: boolean;
  hotspots: SceneAnnotation[];
  panorama_config?: { haov?: number; vaov?: number; vOffset?: number; hfov?: number };
  ai_context?: string;
}

export function Tour360Builder({ experienceId, propertyId }: { experienceId: string; propertyId: string }) {
  const [scenes, setScenes] = useState<Scene[]>([]);
  const [selected, setSelected] = useState<Scene | null>(null);
  const [roomName, setRoomName] = useState("");
  const [mobileTab, setMobileTab] = useState<"rooms" | "annotate">("annotate");

  useEffect(() => {
    fetch(`/api/scenes?experienceId=${experienceId}`)
      .then((r) => r.json())
      .then((data: Scene[]) =>
        setScenes(
          data.map((s) => ({
            ...s,
            hotspots: normalizeAnnotations(s.hotspots ?? []),
          })),
        ),
      )
      .catch(() => {});
  }, [experienceId]);

  async function addScene(fileUrl: string, thumbnailUrl?: string) {
    const res = await fetch("/api/scenes", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        experience_id: experienceId,
        property_id: propertyId,
        room_name: roomName || `Room ${scenes.length + 1}`,
        image_url: fileUrl,
        thumbnail_url: thumbnailUrl ?? fileUrl,
        is_start_scene: scenes.length === 0,
      }),
    });
    const data = await res.json();
    if (!res.ok) return toast.error(data.error);
    const scene = { ...data, hotspots: [] as SceneAnnotation[] };
    setScenes((s) => [...s, scene]);
    setSelected(scene);
    setRoomName("");
    setMobileTab("annotate");
    toast.success("Room added — tap the scene to annotate");
  }

  async function setStartScene(id: string) {
    await fetch(`/api/scenes/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ is_start_scene: true }) });
    setScenes((s) => s.map((sc) => ({ ...sc, is_start_scene: sc.id === id })));
    toast.success("Start scene updated");
  }

  async function publish() {
    const res = await fetch(`/api/experiences/${experienceId}/publish`, { method: "POST" });
    const data = await res.json();
    if (!res.ok) return toast.error(data.error);
    toast.success(`Published: ${data.publishedUrl}`);
  }

  return (
    <div className="space-y-4">
      {/* Mobile tabs */}
      <div className="flex gap-1 rounded-lg border bg-muted/30 p-1 md:hidden">
        <button
          type="button"
          onClick={() => setMobileTab("rooms")}
          className={`flex-1 rounded-md py-2 text-sm font-medium ${mobileTab === "rooms" ? "bg-background shadow-sm" : "text-muted-foreground"}`}
        >
          Rooms
        </button>
        <button
          type="button"
          onClick={() => setMobileTab("annotate")}
          className={`flex-1 rounded-md py-2 text-sm font-medium ${mobileTab === "annotate" ? "bg-background shadow-sm" : "text-muted-foreground"}`}
        >
          Annotate
        </button>
      </div>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,260px)_1fr]">
        {/* Room list — sidebar on desktop, tab on mobile */}
        <Card className={mobileTab === "rooms" ? "block" : "hidden md:block"}>
          <CardHeader>
            <CardTitle className="text-base">Rooms</CardTitle>
            <Input placeholder="Room name" value={roomName} onChange={(e) => setRoomName(e.target.value)} className="mb-2" />
            <MediaUpload propertyId={propertyId} onUploaded={(a) => addScene(a.file_url, a.file_url)} />
          </CardHeader>
          <CardContent className="space-y-2">
            {scenes.map((room) => (
              <div key={room.id} className={`rounded-md border p-2 ${selected?.id === room.id ? "border-primary bg-primary/5" : ""}`}>
                <button
                  type="button"
                  onClick={() => { setSelected(room); setMobileTab("annotate"); }}
                  className="w-full text-left text-sm"
                >
                  {room.room_name}
                  <span className="ml-1 text-xs text-muted-foreground">({room.hotspots?.length ?? 0})</span>
                </button>
                <div className="mt-1 flex gap-1">
                  {room.is_start_scene && <Badge variant="secondary">Start</Badge>}
                  {!room.is_start_scene && (
                    <Button size="sm" variant="ghost" className="h-6 text-xs" onClick={() => setStartScene(room.id)}>
                      Set start
                    </Button>
                  )}
                </div>
              </div>
            ))}
          </CardContent>
        </Card>

        {/* Annotation studio */}
        <div className={mobileTab === "annotate" ? "block" : "hidden md:block"}>
          {selected ? (
            <SpatialAnnotationEditor
              scene={selected}
              scenes={scenes}
              onSave={(hotspots) => {
                setScenes((s) => s.map((sc) => (sc.id === selected.id ? { ...sc, hotspots } : sc)));
                setSelected({ ...selected, hotspots });
              }}
            />
          ) : (
            <Card>
              <CardContent className="flex min-h-[40vh] items-center justify-center text-muted-foreground">
                Select or add a room to start annotating
              </CardContent>
            </Card>
          )}

          <Card className="mt-4">
            <CardHeader><CardTitle className="text-base">Publish</CardTitle></CardHeader>
            <CardContent className="flex flex-col gap-2 sm:flex-row">
              <Button className="flex-1" variant="outline" onClick={async () => {
                const res = await fetch(`/api/experiences/${experienceId}`);
                const exp = await res.json();
                if (exp.slug) window.open(`/view/${exp.slug}`, "_blank");
                else toast.error("Publish first");
              }}>
                Preview
              </Button>
              <Button className="flex-1" onClick={publish}>Publish Experience</Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
