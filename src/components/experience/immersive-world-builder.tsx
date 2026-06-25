"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { ImmersiveGenerationLoader } from "./immersive-generation-loader";
import { MediaUpload } from "@/components/shared/media-upload";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";

const STEPS = ["Upload Photo", "Add Notes", "Generate", "Annotate", "Publish"];

interface BuilderState {
  step: number;
  jobId: string | null;
  notes: string;
  previewUrl: string | null;
  mediaAssetIds: string[];
  startedAt: string | null;
}

export function ImmersiveWorldBuilder({ experienceId, propertyId }: { experienceId: string; propertyId: string }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [restoring, setRestoring] = useState(true);
  const [step, setStep] = useState(0);
  const [notes, setNotes] = useState("");
  const [jobId, setJobId] = useState<string | null>(null);
  const [startedAt, setStartedAt] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [mediaAssetIds, setMediaAssetIds] = useState<string[]>([]);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [slug, setSlug] = useState<string | null>(null);

  const syncUrl = useCallback(
    (next: Partial<BuilderState>) => {
      const params = new URLSearchParams(searchParams.toString());
      params.set("type", "immersive_world");
      params.set("id", experienceId);
      params.set("propertyId", propertyId);
      if (next.jobId) params.set("jobId", next.jobId);
      else params.delete("jobId");
      if (next.step != null && next.step > 0) params.set("step", String(next.step));
      else params.delete("step");
      router.replace(`/dashboard/experiences/builder?${params.toString()}`, { scroll: false });
    },
    [experienceId, propertyId, router, searchParams],
  );

  useEffect(() => {
    let cancelled = false;
    async function restore() {
      try {
        const res = await fetch(`/api/immersive/state?experienceId=${experienceId}`);
        if (!res.ok) throw new Error("Could not restore session");
        const data = await res.json();
        if (cancelled) return;

        const urlJobId = searchParams.get("jobId");
        const urlStep = searchParams.get("step");

        if (data.slug) setSlug(data.slug);
        if (data.notes) setNotes(data.notes);
        if (data.previewUrl) setPreviewUrl(data.previewUrl);
        if (data.mediaAssetIds?.length) setMediaAssetIds(data.mediaAssetIds);

        const resolvedJobId = urlJobId ?? data.jobId ?? null;
        const resolvedStep = urlStep != null ? Number(urlStep) : data.step ?? 0;

        if (resolvedJobId) {
          setJobId(resolvedJobId);
          setStartedAt(data.startedAt ?? null);
          setStep(Math.max(2, resolvedStep));
        } else if (data.mediaAssetIds?.length || data.notes) {
          setStep(resolvedStep > 0 ? resolvedStep : 1);
        } else {
          setStep(0);
        }
      } catch {
        if (!cancelled) toast.error("Could not restore builder state");
      } finally {
        if (!cancelled) setRestoring(false);
      }
    }
    restore();
    return () => { cancelled = true; };
  }, [experienceId, searchParams]);

  async function submitGeneration() {
    if (!mediaAssetIds.length && !notes.trim()) {
      return toast.error("Upload a property photo or describe the scene");
    }
    setUploading(true);
    try {
      const res = await fetch("/api/immersive/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ experienceId, propertyId, prompt: notes.trim() || undefined, mediaAssetIds }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Generation failed");
      setJobId(data.jobId);
      setStartedAt(new Date().toISOString());
      setStep(2);
      syncUrl({ jobId: data.jobId, step: 2 });
      toast.success("Immersive world generation started");
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
    syncUrl({ jobId, step: 4 });
  }

  const previewHref = slug
    ? `/view/${slug}?preview=1`
    : `/view/${experienceId}?preview=1`;

  function handleRetry() {
    setJobId(null);
    setStartedAt(null);
    setStep(0);
    syncUrl({ jobId: null, step: 0 });
  }

  if (restoring) {
    return (
      <div className="flex items-center justify-center gap-2 py-16 text-muted-foreground">
        <Loader2 className="h-5 w-5 animate-spin" />
        Restoring your session…
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold">Immersive World</h2>
        <p className="text-muted-foreground">
          Turn a property photo into an explorable 3D environment buyers can walk through.
        </p>
      </div>
      <div className="flex flex-wrap gap-2">
        {STEPS.map((s, i) => (
          <Badge key={s} variant={i <= step ? "default" : "outline"}>{s}</Badge>
        ))}
      </div>
      <Progress value={((step + 1) / STEPS.length) * 100} />

      {step === 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Property Photo</CardTitle>
            <CardDescription>Upload a clear exterior or interior shot — wide angle works best.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {previewUrl && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={previewUrl} alt="Uploaded property" className="max-h-48 rounded-lg border object-cover" />
            )}
            <MediaUpload
              propertyId={propertyId}
              onUploaded={(a) => {
                setMediaAssetIds([a.id]);
                setPreviewUrl(a.file_url);
              }}
            />
            <Button onClick={() => { setStep(1); syncUrl({ step: 1, jobId }); }} disabled={!mediaAssetIds.length && !notes.trim()}>
              Continue
            </Button>
          </CardContent>
        </Card>
      )}

      {step === 1 && (
        <Card>
          <CardHeader>
            <CardTitle>Scene Notes</CardTitle>
            <CardDescription>Optional context — room type, lighting, or features to emphasize.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {previewUrl && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={previewUrl} alt="Property preview" className="max-h-32 rounded-lg border object-cover" />
            )}
            <Textarea
              placeholder="e.g. Sunlit living room with floor-to-ceiling windows and hardwood floors"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
            />
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => { setStep(0); syncUrl({ step: 0, jobId }); }}>Back</Button>
              <Button onClick={submitGeneration} disabled={uploading}>
                {uploading ? "Starting…" : "Generate Immersive World"}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {step === 2 && jobId && (
        <ImmersiveGenerationLoader
          jobId={jobId}
          startedAt={startedAt}
          onReady={() => { setStep(3); syncUrl({ jobId, step: 3 }); }}
          onRetry={handleRetry}
        />
      )}

      {step === 3 && (
        <Card>
          <CardHeader>
            <CardTitle>Annotate &amp; Review</CardTitle>
            <CardDescription>Add floor maps and checkpoints before publishing to buyers.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <Button asChild variant="outline">
              <a href={`/dashboard/floor-maps?propertyId=${propertyId}&experienceId=${experienceId}`}>Add Floor Map</a>
            </Button>
            <Button asChild variant="outline">
              <a href={`/dashboard/checkpoints?propertyId=${propertyId}&experienceId=${experienceId}`}>Add Checkpoints</a>
            </Button>
            <Button asChild variant="outline">
              <a href={previewHref} target="_blank" rel="noreferrer">Preview 3D Viewer</a>
            </Button>
            <Button onClick={publish}>Publish Experience</Button>
          </CardContent>
        </Card>
      )}

      {step === 4 && (
        <Card>
          <CardHeader>
            <CardTitle>Published</CardTitle>
            <CardDescription>Your immersive world is live for buyers.</CardDescription>
          </CardHeader>
          <CardContent>
            <Button asChild>
              <a href={slug ? `/view/${slug}` : previewHref} target="_blank" rel="noreferrer">View Live Tour</a>
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
