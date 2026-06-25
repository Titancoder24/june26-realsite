"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";

interface Hotspot {
  id: string;
  label: string;
  yaw: number;
  pitch: number;
  targetSceneId?: string;
}

export function HotspotEditor({
  sceneId,
  hotspots,
  scenes,
  onSave,
}: {
  sceneId: string;
  hotspots: Hotspot[];
  scenes: { id: string; room_name: string }[];
  onSave: (hotspots: Hotspot[]) => void;
}) {
  const [items, setItems] = useState(hotspots);
  const [label, setLabel] = useState("");
  const [target, setTarget] = useState("");

  function addHotspot() {
    if (!label || !target) return;
    setItems([...items, { id: crypto.randomUUID(), label, yaw: 0, pitch: 0, targetSceneId: target }]);
    setLabel("");
    setTarget("");
  }

  async function persist() {
    const res = await fetch(`/api/scenes/${sceneId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ hotspots: items }),
    });
    if (!res.ok) return toast.error("Failed to save hotspots");
    onSave(items);
    toast.success("Hotspots saved");
  }

  return (
    <div className="space-y-3 rounded-lg border p-4">
      <p className="text-sm font-medium">Hotspot Editor</p>
      <div className="flex gap-2">
        <Input placeholder="Label" value={label} onChange={(e) => setLabel(e.target.value)} className="flex-1" />
        <select className="rounded-md border px-2 text-sm" value={target} onChange={(e) => setTarget(e.target.value)}>
          <option value="">Target room</option>
          {scenes.filter((s) => s.id !== sceneId).map((s) => <option key={s.id} value={s.id}>{s.room_name}</option>)}
        </select>
        <Button size="sm" onClick={addHotspot}>Add</Button>
      </div>
      {items.map((h) => (
        <div key={h.id} className="flex justify-between text-sm">
          <span>{h.label} → {scenes.find((s) => s.id === h.targetSceneId)?.room_name}</span>
          <Button size="sm" variant="ghost" onClick={() => setItems(items.filter((i) => i.id !== h.id))}>×</Button>
        </div>
      ))}
      <Button size="sm" className="w-full" onClick={persist}>Save Hotspots</Button>
    </div>
  );
}
