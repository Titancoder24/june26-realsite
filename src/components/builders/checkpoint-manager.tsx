"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { ImmersiveCheckpointPlacer } from "@/components/experience/immersive-checkpoint-placer";
import { toast } from "sonner";

interface Checkpoint {
  id: string;
  title: string;
  description?: string;
  checkpoint_type: string;
  ai_context?: string;
  visibility: string;
}

const TYPES = ["info", "room_detail", "view", "amenity", "cta", "pricing", "legal_disclaimer"];

export function CheckpointManager({ experienceId, propertyId }: { experienceId: string; propertyId: string }) {
  const [checkpoints, setCheckpoints] = useState<Checkpoint[]>([]);
  const [form, setForm] = useState({ title: "", description: "", checkpoint_type: "info", ai_context: "" });
  const [experienceType, setExperienceType] = useState<string | null>(null);
  const [slug, setSlug] = useState<string | null>(null);

  useEffect(() => {
    fetch(`/api/checkpoints?experienceId=${experienceId}`).then((r) => r.json()).then(setCheckpoints).catch(() => {});
    fetch(`/api/experiences/${experienceId}`)
      .then((r) => r.json())
      .then((exp) => {
        setExperienceType(exp.type ?? null);
        setSlug(exp.slug ?? null);
      })
      .catch(() => {});
  }, [experienceId]);

  async function create() {
    const res = await fetch("/api/checkpoints", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...form, experience_id: experienceId, property_id: propertyId }),
    });
    const data = await res.json();
    if (!res.ok) return toast.error(data.error);
    setCheckpoints((c) => [...c, data]);
    setForm({ title: "", description: "", checkpoint_type: "info", ai_context: "" });
    toast.success("Checkpoint saved + synced to RAG");
  }

  const isImmersive = experienceType === "immersive_world" || experienceType === "worldlabs_splat";

  return (
    <div className="space-y-6">
      {isImmersive && (
        <ImmersiveCheckpointPlacer experienceId={experienceId} propertyId={propertyId} slug={slug ?? undefined} />
      )}
      <Card>
        <CardHeader><CardTitle>Add Checkpoint</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <Input placeholder="Title" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
          <Input placeholder="Description" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
          <Input placeholder="AI context (RAG)" value={form.ai_context} onChange={(e) => setForm({ ...form, ai_context: e.target.value })} />
          <select className="w-full rounded-md border px-3 py-2 text-sm" value={form.checkpoint_type} onChange={(e) => setForm({ ...form, checkpoint_type: e.target.value })}>
            {TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
          </select>
          <Button onClick={create} disabled={!form.title}>Save Checkpoint</Button>
        </CardContent>
      </Card>
      <Card>
        <CardHeader><CardTitle>Checkpoints ({checkpoints.length})</CardTitle></CardHeader>
        <CardContent className="space-y-2">
          {checkpoints.map((cp) => (
            <div key={cp.id} className="flex items-center justify-between rounded border p-3">
              <div>
                <p className="font-medium">{cp.title}</p>
                <p className="text-xs text-muted-foreground">{cp.description}</p>
              </div>
              <Badge variant="secondary">{cp.checkpoint_type}</Badge>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
