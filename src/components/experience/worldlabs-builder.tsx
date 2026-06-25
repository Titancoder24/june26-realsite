"use client";

import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { WorldLabsJobStatus } from "./worldlabs-job-status";
import { MediaUpload } from "@/components/shared/media-upload";
import { toast } from "sonner";

const STEPS = ["Upload Media", "Add Context", "Generate", "Review", "Publish"];

export function WorldLabsBuilder({ experienceId, propertyId }: { experienceId: string; propertyId: string }) {
  const [step, setStep] = useState(0);
  const [prompt, setPrompt] = useState("");
  const [jobId, setJobId] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [mediaAssetIds, setMediaAssetIds] = useState<string[]>([]);
  const [worldLabsReady, setWorldLabsReady] = useState(0);

  async function submitGeneration() {
    if (!mediaAssetIds.length) return toast.error("Upload at least one image");
    if (worldLabsReady < mediaAssetIds.length) return toast.error("World Labs upload incomplete. Re-upload your images.");
    setUploading(true);
    try {
      const res = await fetch("/api/worldlabs/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ experienceId, propertyId, prompt, mediaAssetIds }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Generation failed");
      setJobId(data.jobId);
      setStep(2);
      toast.success("3D generation started");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed");
    } finally {
      setUploading(false);
    }
  }

  async function publish() {
    const res = await fetch(`/api/experiences/${experienceId}/publish`, { method: "POST" });
    const data = await res.json();
    if (!res.ok) return toast.error(data.error);
    toast.success(`Published: ${data.publishedUrl}`);
    setStep(4);
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold">Generate 3D Walkthrough</h2>
        <p className="text-muted-foreground">Upload property media to create an immersive 3D experience</p>
      </div>
      <div className="flex gap-2">{STEPS.map((s, i) => <Badge key={s} variant={i <= step ? "default" : "outline"}>{s}</Badge>)}</div>
      <Progress value={((step + 1) / STEPS.length) * 100} />

      {step === 0 && (
        <Card>
          <CardHeader><CardTitle>Upload Property Media</CardTitle><CardDescription>{mediaAssetIds.length} file(s) ready</CardDescription></CardHeader>
          <CardContent className="space-y-4">
            <MediaUpload
              propertyId={propertyId}
              forWorldLabs
              onUploaded={(a) => {
                setMediaAssetIds((ids) => [...ids, a.id]);
                if (a.worldlabs_media_asset_id) setWorldLabsReady((n) => n + 1);
              }}
            />
            <Button onClick={() => setStep(1)} disabled={!mediaAssetIds.length}>Continue</Button>
          </CardContent>
        </Card>
      )}

      {step === 1 && (
        <Card>
          <CardHeader><CardTitle>Generation Context</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <Input placeholder="e.g. Modern 3BHK apartment with balcony view" value={prompt} onChange={(e) => setPrompt(e.target.value)} />
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setStep(0)}>Back</Button>
              <Button onClick={submitGeneration} disabled={uploading}>{uploading ? "Starting…" : "Generate 3D Walkthrough"}</Button>
            </div>
          </CardContent>
        </Card>
      )}

      {step >= 2 && jobId && <WorldLabsJobStatus jobId={jobId} onReady={() => setStep(3)} />}

      {step === 3 && (
        <Card>
          <CardHeader><CardTitle>Ready for Review</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            <Button asChild variant="outline"><a href={`/dashboard/floor-maps?propertyId=${propertyId}&experienceId=${experienceId}`}>Add Floor Map</a></Button>
            <Button asChild variant="outline"><a href={`/dashboard/checkpoints?propertyId=${propertyId}&experienceId=${experienceId}`}>Add Checkpoints</a></Button>
            <Button onClick={publish}>Publish Experience</Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
