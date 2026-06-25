"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { MediaUpload } from "@/components/shared/media-upload";
import { toast } from "sonner";

interface Pin {
  id: string;
  name: string;
  x: number;
  y: number;
  sceneId?: string;
  cameraPosition?: { x: number; y: number; z: number };
}

export function FloorMapBuilder({
  propertyId,
  experienceId,
  initialMap,
}: {
  propertyId: string;
  experienceId?: string;
  initialMap?: { id: string; image_url: string; pins: Pin[] };
}) {
  const [imageUrl, setImageUrl] = useState(initialMap?.image_url ?? "");
  const [pins, setPins] = useState<Pin[]>(initialMap?.pins ?? []);
  const [mapId, setMapId] = useState(initialMap?.id);
  const [placing, setPlacing] = useState(false);
  const [pinName, setPinName] = useState("");
  const [scenes, setScenes] = useState<{ id: string; room_name: string }[]>([]);
  const [selectedPin, setSelectedPin] = useState<string | null>(null);

  useEffect(() => {
    if (experienceId) {
      fetch(`/api/scenes?experienceId=${experienceId}`).then((r) => r.json()).then(setScenes).catch(() => {});
    }
  }, [experienceId]);

  function handleMapClick(e: React.MouseEvent<HTMLDivElement>) {
    if (!placing || !imageUrl) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * 100;
    const y = ((e.clientY - rect.top) / rect.height) * 100;
    const id = crypto.randomUUID();
    setPins((p) => [...p, { id, name: pinName || `Pin ${p.length + 1}`, x, y, cameraPosition: { x: 0, y: 1, z: 0 } }]);
    setSelectedPin(id);
    setPlacing(false);
    setPinName("");
  }

  function updatePin(id: string, patch: Partial<Pin>) {
    setPins((p) => p.map((pin) => pin.id === id ? { ...pin, ...patch } : pin));
  }

  async function save() {
    if (!imageUrl) return toast.error("Upload a floor plan first");
    const payload = { property_id: propertyId, experience_id: experienceId, image_url: imageUrl, name: "Floor Map", pins };
    const res = await fetch(mapId ? `/api/floor-maps/${mapId}` : "/api/floor-maps", {
      method: mapId ? "PATCH" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const data = await res.json();
    if (!res.ok) return toast.error(data.error);
    if (!mapId) setMapId(data.id);
    toast.success("Floor map saved");
  }

  const activePin = pins.find((p) => p.id === selectedPin);

  return (
    <div className="grid gap-4 md:gap-6 lg:grid-cols-[1fr_minmax(0,300px)]">
      <Card>
        <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <CardTitle>Floor Plan</CardTitle>
          <MediaUpload propertyId={propertyId} onUploaded={(a) => setImageUrl(a.file_url)} />
        </CardHeader>
        <CardContent>
          <div className="relative aspect-video cursor-crosshair rounded-lg border bg-muted" onClick={handleMapClick}>
            {imageUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={imageUrl} alt="Floor plan" className="h-full w-full object-contain" />
            ) : (
              <div className="flex h-full items-center justify-center text-muted-foreground">Upload floor plan</div>
            )}
            {pins.map((p) => (
              <button
                key={p.id}
                type="button"
                className={`absolute h-3 w-3 -translate-x-1/2 -translate-y-1/2 rounded-full ring-2 ring-white ${selectedPin === p.id ? "bg-amber-500" : "bg-primary"}`}
                style={{ left: `${p.x}%`, top: `${p.y}%` }}
                title={p.name}
                onClick={(e) => { e.stopPropagation(); setSelectedPin(p.id); }}
              />
            ))}
          </div>
        </CardContent>
      </Card>
      <Card>
        <CardHeader><CardTitle className="text-base">Pins</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <Input placeholder="Pin name" value={pinName} onChange={(e) => setPinName(e.target.value)} />
          <Button variant={placing ? "default" : "outline"} className="w-full" onClick={() => setPlacing(!placing)}>
            {placing ? "Click map to place…" : "Add Pin"}
          </Button>
          {activePin && (
            <div className="space-y-2 rounded border p-3">
              <p className="text-sm font-medium">{activePin.name}</p>
              <select className="w-full rounded border px-2 py-1 text-sm" value={activePin.sceneId ?? ""} onChange={(e) => updatePin(activePin.id, { sceneId: e.target.value })}>
                <option value="">Link 360 scene</option>
                {scenes.map((s) => <option key={s.id} value={s.id}>{s.room_name}</option>)}
              </select>
              <p className="text-xs text-muted-foreground">3D camera position</p>
              {(["x", "y", "z"] as const).map((axis) => (
                <Input
                  key={axis}
                  type="number"
                  step="0.1"
                  placeholder={axis}
                  value={activePin.cameraPosition?.[axis] ?? 0}
                  onChange={(e) => updatePin(activePin.id, {
                    cameraPosition: { ...activePin.cameraPosition, [axis]: Number(e.target.value) } as { x: number; y: number; z: number },
                  })}
                />
              ))}
            </div>
          )}
          <Button className="w-full" onClick={save}>Save Map</Button>
        </CardContent>
      </Card>
    </div>
  );
}
