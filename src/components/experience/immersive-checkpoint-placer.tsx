"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { SplatViewer } from "@/components/buyer/splat-viewer";
import { toast } from "sonner";
import { MapPin } from "lucide-react";

export function ImmersiveCheckpointPlacer({
  experienceId,
  propertyId,
  slug,
}: {
  experienceId: string;
  propertyId: string;
  slug?: string;
}) {
  const [splat, setSplat] = useState<{
    spz_full_res_url?: string;
    spz_500k_url?: string;
    viewer_url?: string;
    provider?: string;
  } | null>(null);
  const [position, setPosition] = useState({ x: 0, y: 1, z: 3 });
  const [form, setForm] = useState({ title: "", description: "", checkpoint_type: "info" });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetch(`/api/experiences/${experienceId}`)
      .then((r) => r.json())
      .then((exp) => setSplat(exp.splat_worlds?.[0] ?? null))
      .catch(() => {});
  }, [experienceId]);

  async function placePin() {
    if (!form.title.trim()) return toast.error("Enter a pin title");
    setSaving(true);
    try {
      const res = await fetch("/api/checkpoints", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...form,
          experience_id: experienceId,
          property_id: propertyId,
          position: { x: position.x, y: position.y, z: position.z, type: "3d" },
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed");
      toast.success(`Pin "${form.title}" placed in 3D world`);
      setForm({ title: "", description: "", checkpoint_type: "info" });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed");
    } finally {
      setSaving(false);
    }
  }

  const previewHref = slug
    ? `/view/${slug}?preview=1`
    : `/view/${experienceId}?preview=1`;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <MapPin className="h-5 w-5 text-primary" />
          Place 3D Annotations
        </CardTitle>
        <CardDescription>
          Walk through the world with WASD, then place a pin at your current position.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="relative h-64 overflow-hidden rounded-lg border bg-black sm:h-80">
          {splat?.spz_full_res_url || splat?.spz_500k_url || splat?.viewer_url ? (
            <SplatViewer
              experienceId={experienceId}
              spz500kUrl={splat.spz_500k_url}
              spzFullResUrl={splat.spz_full_res_url}
              splatFormat={splat.provider === "spaitial" ? "spz" : undefined}
              onPositionChange={(x, y, z) => setPosition({ x, y, z })}
            />
          ) : (
            <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
              Generate the immersive world first to place pins.
            </div>
          )}
        </div>

        <p className="text-xs text-muted-foreground tabular-nums">
          Position: x {position.x.toFixed(2)}, y {position.y.toFixed(2)}, z {position.z.toFixed(2)}
        </p>

        <div className="grid gap-2 sm:grid-cols-2">
          <Input placeholder="Pin title" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
          <Input placeholder="Description" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
        </div>

        <div className="flex flex-wrap gap-2">
          <Button onClick={placePin} disabled={saving || !splat}>
            {saving ? "Saving…" : "Place pin here"}
          </Button>
          <Button variant="outline" asChild>
            <a href={previewHref} target="_blank" rel="noreferrer">Open full preview</a>
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
