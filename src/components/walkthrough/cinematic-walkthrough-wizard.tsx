"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { WalkthroughPropertyKnowledgePanel } from "@/components/walkthrough/walkthrough-property-knowledge-panel";
import { WalkthroughVoiceTest } from "@/components/walkthrough/walkthrough-voice-test";
import { WalkthroughOwnerVoiceSettings } from "@/components/walkthrough/walkthrough-owner-voice-settings";
import { WalkthroughBrainSettings } from "@/components/walkthrough/walkthrough-brain-settings";
import { PropertyKnowledgeSummary } from "@/components/walkthrough/property-knowledge-summary";
import { WalkthroughAnnotationEditor } from "@/components/walkthrough/walkthrough-annotation-editor";
import { WalkthroughArrangePanel } from "@/components/walkthrough/walkthrough-arrange-panel";
import { formatConfidence, getSceneClassification, roomTypeLabel } from "@/lib/walkthrough-scene-meta";
import type { WalkthroughChecklist, WalkthroughImage, WalkthroughScene, WalkthroughWizardStep } from "@/types/cinematic-walkthrough";
import type { StructuredPropertyKnowledge } from "@/types/property-knowledge";
import { WALKTHROUGH_MOTION_PRESETS, WALKTHROUGH_WIZARD_STEPS } from "@/types/cinematic-walkthrough";
import type { WalkthroughMotionType } from "@/types/cinematic-walkthrough";
import {
  VIDEO_WALKTHROUGH_ANNOTATIONS_ENABLED,
} from "@/lib/walkthrough-video-features";
import { veoPromptForMotion } from "@/lib/veo-motion-prompts";
import {
  DEFAULT_VEO_GENERATION_MODE,
  VEO_GENERATION_MODES,
  type VeoGenerationMode,
} from "@/lib/veo-video-models";
import { resolveWalkthroughSceneVideoUrl } from "@/lib/walkthrough-scene-video";
import {
  DEFAULT_VOICE_PROFILE,
  parseViewerVoiceProfile,
  type WalkthroughVoiceProfile,
} from "@/lib/walkthrough-voice-providers";
import {
  DEFAULT_BRAIN_PROVIDER,
  parseBrainProviderFromViewerConfig,
  type WalkthroughBrainProvider,
} from "@/lib/walkthrough-brain-provider";
import { getAdaptivePollIntervalMs } from "@/lib/walkthrough-pipeline/adaptive-poll";
import { formatDurationMinSec, formatTimerMmSs } from "@/lib/format-duration";
import type { VideoQualityValidation } from "@/types/video-quality-validation";
import {
  uploadWalkthroughImageWithProgress,
  type WalkthroughUploadQueueItem,
} from "@/lib/walkthrough-upload-client";
import { Check, Clapperboard, ExternalLink, Loader2, Sparkles, Upload, Wand2, XCircle } from "lucide-react";
import { toast } from "sonner";
import "@/styles/walkthrough-studio.css";

export function CinematicWalkthroughWizard({
  experienceId,
  propertyId,
  slug,
}: {
  experienceId: string;
  propertyId: string;
  slug?: string;
}) {
  const [step, setStep] = useState<WalkthroughWizardStep>("upload");
  const [images, setImages] = useState<WalkthroughImage[]>([]);
  const [scenes, setScenes] = useState<WalkthroughScene[]>([]);
  const [checklist, setChecklist] = useState<WalkthroughChecklist | null>(null);
  const [enhancing, setEnhancing] = useState(false);
  const [planning, setPlanning] = useState(false);
  const [generatingMotion, setGeneratingMotion] = useState(false);
  const [videoJobs, setVideoJobs] = useState<
    {
      id?: string;
      status: string;
      scene_id: string;
      stored_video_url?: string | null;
      error?: string | null;
      model?: string | null;
      validation_result?: VideoQualityValidation | null;
      generation_duration_ms?: number | null;
      started_at?: string | null;
    }[]
  >([]);
  const [activePinSceneId, setActivePinSceneId] = useState<string | null>(null);
  const [, setAiTestReply] = useState<string | null>(null);
  const [aiTestCommand, setAiTestCommand] = useState<string | null>(null);
  const [structuredKnowledge, setStructuredKnowledge] = useState<StructuredPropertyKnowledge | null>(null);
  const [viewerConfig, setViewerConfig] = useState<Record<string, unknown>>({});
  const [viewerVoiceProfile, setViewerVoiceProfile] = useState<WalkthroughVoiceProfile>(DEFAULT_VOICE_PROFILE);
  const [brainProvider, setBrainProvider] = useState<WalkthroughBrainProvider>(DEFAULT_BRAIN_PROVIDER);
  const [savingVoiceProfile, setSavingVoiceProfile] = useState(false);
  const [savingBrainProvider, setSavingBrainProvider] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [experienceStatus, setExperienceStatus] = useState<string | null>(null);
  const [experienceSlug, setExperienceSlug] = useState<string | undefined>(slug);
  const [publishedUrl, setPublishedUrl] = useState<string | null>(null);
  const [regeneratingSceneId, setRegeneratingSceneId] = useState<string | null>(null);
  const [videoGenerationMode, setVideoGenerationMode] = useState<VeoGenerationMode>(DEFAULT_VEO_GENERATION_MODE);
  const [videoProgress, setVideoProgress] = useState<{
    stage: string;
    completed: number;
    total: number;
    pending: number;
    failed: number;
    estimatedRemainingSeconds: number | null;
    estimateIsApproximate?: boolean;
    startedAt?: string | null;
  } | null>(null);
  const [videoTimerTick, setVideoTimerTick] = useState(0);
  const [videoCompletionSummary, setVideoCompletionSummary] = useState<string | null>(null);
  const [lastPollResults, setLastPollResults] = useState<
    { jobId: string; status: string; validation?: VideoQualityValidation; generationDurationMs?: number; model?: string; error?: string }[]
  >([]);
  const [uploadQueue, setUploadQueue] = useState<WalkthroughUploadQueueItem[]>([]);
  const [uploading, setUploading] = useState(false);
  const [enhanceQueue, setEnhanceQueue] = useState<
    { imageId: string; fileName: string; status: "queued" | "processing" | "done" | "failed"; error?: string }[]
  >([]);
  const [enhanceProgress, setEnhanceProgress] = useState({ done: 0, total: 0, failed: 0 });
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const pollTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pollInFlightRef = useRef(false);
  const pollStartedAtRef = useRef<number | null>(null);

  const canPublish = Boolean(
    (checklist?.images_uploaded && checklist?.scenes_created) ||
      (images.length > 0 && scenes.length > 0),
  );
  const appBase = (process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000").replace(/\/$/, "");
  const isPublished = experienceStatus === "published";
  const sharePath = `/walkthrough/${experienceSlug ?? slug ?? experienceId}${isPublished ? "" : "?preview=1"}`;
  const shareUrl = publishedUrl ?? `${appBase}${sharePath}`;
  const studioPreviewPath = `/walkthrough/${experienceSlug ?? slug ?? experienceId}?preview=1`;

  const resolveSceneVideo = useCallback(
    (scene: WalkthroughScene) => {
      const job = videoJobs.find((j) => j.scene_id === scene.id);
      return resolveWalkthroughSceneVideoUrl(scene, job);
    },
    [videoJobs],
  );

  const motionReadyCount = scenes.filter((s) => resolveSceneVideo(s)).length;

  const load = useCallback(async () => {
    const [imgRes, sceneRes, checkRes, jobsRes, expRes] = await Promise.all([
      fetch(`/api/walkthrough/images?experienceId=${experienceId}`),
      fetch(`/api/walkthrough/scenes?experienceId=${experienceId}`),
      fetch(`/api/walkthrough/checklist/${experienceId}`),
      fetch(`/api/walkthrough/video/jobs?experienceId=${experienceId}`),
      fetch(`/api/experiences/${experienceId}`),
    ]);

    if (!imgRes.ok) {
      const err = await imgRes.json().catch(() => ({}));
      throw new Error(err.error ?? "Failed to load images");
    }
    if (!sceneRes.ok) {
      const err = await sceneRes.json().catch(() => ({}));
      throw new Error(err.error ?? "Failed to load scenes");
    }

    const [imgData, sceneData, checkData, jobsData, expData] = await Promise.all([
      imgRes.json(),
      sceneRes.json(),
      checkRes.json(),
      jobsRes.ok ? jobsRes.json() : [],
      expRes.ok ? expRes.json() : null,
    ]);

    if (Array.isArray(imgData)) setImages(imgData);
    if (Array.isArray(sceneData)) {
      setScenes(sceneData);
      setActivePinSceneId((prev) => prev ?? sceneData[0]?.id ?? null);
    }
    if (checkRes.ok && typeof checkData?.images_uploaded === "boolean") {
      setChecklist({
        experience_id: experienceId,
        warnings: [],
        ...checkData,
      });
    }
    if (Array.isArray(jobsData)) setVideoJobs(jobsData);
    if (expData) {
      if (expData.slug) setExperienceSlug(expData.slug);
      if (expData.status) setExperienceStatus(expData.status);
      if (expData.published_url) setPublishedUrl(expData.published_url);
      if (expData.viewer_config) {
        const config = expData.viewer_config as Record<string, unknown>;
        setViewerConfig(config);
        setViewerVoiceProfile(parseViewerVoiceProfile(config));
        setBrainProvider(parseBrainProviderFromViewerConfig(config) ?? DEFAULT_BRAIN_PROVIDER);
      }
    }
  }, [experienceId]);

  async function saveBrainProvider(provider: WalkthroughBrainProvider) {
    setSavingBrainProvider(true);
    try {
      const nextConfig = { ...viewerConfig, brain_provider: provider };
      const res = await fetch(`/api/experiences/${experienceId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ viewer_config: nextConfig }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? "Failed to save AI brain setting");
      setViewerConfig(nextConfig);
      setBrainProvider(provider);
      toast.success("Property AI brain saved to Supabase");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to save AI brain setting");
    } finally {
      setSavingBrainProvider(false);
    }
  }

  async function saveViewerVoiceProfile(profile: WalkthroughVoiceProfile) {
    setSavingVoiceProfile(true);
    try {
      const nextConfig = { ...viewerConfig, voice_profile: profile };
      const res = await fetch(`/api/experiences/${experienceId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ viewer_config: nextConfig }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? "Failed to save voice mode");
      setViewerConfig(nextConfig);
      setViewerVoiceProfile(profile);
      toast.success("Buyer voice mode saved");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to save voice mode");
    } finally {
      setSavingVoiceProfile(false);
    }
  }

  useEffect(() => {
    load().catch((e) => toast.error(e instanceof Error ? e.message : "Failed to load walkthrough"));
  }, [load]);

  useEffect(() => {
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
      if (pollTimeoutRef.current) clearTimeout(pollTimeoutRef.current);
    };
  }, []);

  useEffect(() => {
    if (!generatingMotion) return;
    const id = setInterval(() => setVideoTimerTick((t) => t + 1), 1000);
    return () => clearInterval(id);
  }, [generatingMotion]);

  useEffect(() => {
    if (step !== "preview" && step !== "publish") return;
    if (structuredKnowledge) return;
    fetch(`/api/walkthrough/rag/knowledge?propertyId=${propertyId}`)
      .then((r) => r.json())
      .then((d) => setStructuredKnowledge(d.structured_knowledge ?? null))
      .catch(() => undefined);
  }, [step, propertyId, structuredKnowledge]);

  async function prepareImagesForPlanning() {
    const pending = images.filter((img) => img.enhancement_status === "pending" || img.enhancement_status === "processing");
    for (const img of pending) {
      await fetch(`/api/walkthrough/images/${img.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ enhancement_status: "skipped" }),
      });
    }
    if (pending.length) await load();
  }

  async function pollVideoJobs() {
    if (pollInFlightRef.current) return;
    pollInFlightRef.current = true;
    try {
      const res = await fetch("/api/walkthrough/video/poll", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ experience_id: experienceId, video_mode: videoGenerationMode }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error ?? "Failed to poll video jobs");
        return;
      }
      if (data.progress) setVideoProgress(data.progress);
      if (Array.isArray(data.results)) setLastPollResults(data.results);
      await load();
      if ((data.pending ?? 0) === 0) {
        if (pollRef.current) {
          clearInterval(pollRef.current);
          pollRef.current = null;
        }
        if (pollTimeoutRef.current) {
          clearTimeout(pollTimeoutRef.current);
          pollTimeoutRef.current = null;
        }
        const batchElapsedMs = pollStartedAtRef.current ? Date.now() - pollStartedAtRef.current : 0;
        const resultDurations = (data.results ?? [])
          .map((r: { generationDurationMs?: number }) => r.generationDurationMs)
          .filter((ms: number | undefined): ms is number => typeof ms === "number" && ms > 0);
        const avgDurationMs = resultDurations.length
          ? Math.round(resultDurations.reduce((a: number, b: number) => a + b, 0) / resultDurations.length)
          : batchElapsedMs;
        const modeLabel = videoGenerationMode === "fast" ? "Fast generation" : "Quality generation";
        setVideoCompletionSummary(
          `${modeLabel} · Completed in ${formatDurationMinSec(batchElapsedMs)} (avg ${formatDurationMinSec(avgDurationMs)} per clip)`,
        );
        setGeneratingMotion(false);
        setVideoProgress(null);
        pollStartedAtRef.current = null;
        const ready = scenes.filter((s) => resolveWalkthroughSceneVideoUrl(
          s,
          videoJobs.find((j) => j.scene_id === s.id),
        )).length || data.progress?.completed || 0;
        const validationFailed = (data.results ?? []).filter(
          (r: { validation?: VideoQualityValidation }) => r.validation && !r.validation.passed,
        ).length;
        if (ready > 0) toast.success(`Motion ready for ${ready} scene${ready === 1 ? "" : "s"}`);
        if (validationFailed > 0) {
          toast.warning(`${validationFailed} clip${validationFailed === 1 ? "" : "s"} failed AI quality check — retry with the same model`);
        }
        if (data.failed > 0) toast.warning(`${data.failed} Veo job${data.failed === 1 ? "" : "s"} failed — regenerate motion before publishing`);
      } else {
        scheduleNextPoll();
      }
    } finally {
      pollInFlightRef.current = false;
    }
  }

  function scheduleNextPoll() {
    if (pollTimeoutRef.current) clearTimeout(pollTimeoutRef.current);
    const elapsed = pollStartedAtRef.current ? Date.now() - pollStartedAtRef.current : 0;
    const interval = getAdaptivePollIntervalMs(elapsed);
    pollTimeoutRef.current = setTimeout(() => {
      pollVideoJobs().catch(() => {});
    }, interval);
  }

  function startVideoPolling(options?: { preserveStartTime?: boolean }) {
    if (pollRef.current) clearInterval(pollRef.current);
    if (pollTimeoutRef.current) clearTimeout(pollTimeoutRef.current);
    if (!options?.preserveStartTime) {
      pollStartedAtRef.current = Date.now();
      setVideoCompletionSummary(null);
      setLastPollResults([]);
    }
    pollVideoJobs().catch(() => {});
  }

  // Resume background polling when pending jobs exist on load
  useEffect(() => {
    const pending = videoJobs.some((j) => ["queued", "submitted", "processing", "retrying"].includes(j.status));
    if (pending && !pollStartedAtRef.current) {
      setGeneratingMotion(true);
      const earliest = videoJobs
        .filter((j) => ["queued", "submitted", "processing", "retrying"].includes(j.status))
        .map((j) => j.started_at)
        .filter(Boolean)
        .sort()[0];
      pollStartedAtRef.current = earliest ? new Date(earliest).getTime() : Date.now();
      startVideoPolling({ preserveStartTime: true });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- resume poll once when jobs load
  }, [videoJobs]);

  async function onFilesSelected(files: FileList | null) {
    if (!files?.length) return;

    const remaining = Math.max(0, 35 - images.length);
    const toUpload = Array.from(files).slice(0, remaining);
    if (!toUpload.length) {
      toast.error("Maximum 35 images per walkthrough");
      return;
    }

    if (files.length > remaining) {
      toast.warning(`Only ${remaining} more image${remaining === 1 ? "" : "s"} can be added (35 max)`);
    }

    const initialQueue: WalkthroughUploadQueueItem[] = toUpload.map((file) => ({
      clientId: crypto.randomUUID(),
      fileName: file.name,
      status: "queued",
      progress: 0,
    }));

    setUploadQueue(initialQueue);
    setUploading(true);

    const updateQueueItem = (clientId: string, patch: Partial<WalkthroughUploadQueueItem>) => {
      setUploadQueue((prev) => prev.map((item) => (item.clientId === clientId ? { ...item, ...patch } : item)));
    };

    const results = await Promise.allSettled(
      toUpload.map(async (file, index) => {
        const clientId = initialQueue[index].clientId;
        updateQueueItem(clientId, { status: "uploading", progress: 0 });

        try {
          const data = await uploadWalkthroughImageWithProgress(
            file,
            { experienceId, propertyId },
            (progress) => updateQueueItem(clientId, { progress }),
          );
          updateQueueItem(clientId, { status: "done", progress: 100 });
          return data;
        } catch (err) {
          const message = err instanceof Error ? err.message : "Upload failed";
          updateQueueItem(clientId, { status: "failed", error: message, progress: 0 });
          throw err;
        }
      }),
    );

    const succeeded = results.filter((r) => r.status === "fulfilled").length;
    const failed = results.length - succeeded;

    setUploading(false);
    await load();

    if (succeeded > 0 && failed === 0) {
      toast.success(`Uploaded ${succeeded} image${succeeded === 1 ? "" : "s"}`);
    } else if (succeeded > 0) {
      toast.warning(`Uploaded ${succeeded}, ${failed} failed`);
    } else {
      toast.error("All uploads failed");
    }

    window.setTimeout(() => setUploadQueue([]), 2500);
  }

  async function enhanceAll() {
    const pending = images.filter((img) =>
      img.enhancement_status === "pending" || img.enhancement_status === "failed",
    );
    if (!pending.length) {
      toast.info("All images already enhanced — continue to scene planning");
      setStep("scenes");
      return;
    }

    setEnhancing(true);
    setEnhanceQueue(
      pending.map((img) => ({
        imageId: img.id,
        fileName: img.file_name,
        status: "queued" as const,
      })),
    );
    setEnhanceProgress({ done: 0, total: pending.length, failed: 0 });

    let done = 0;
    let failed = 0;
    const CONCURRENCY = 2;

    const updateQueueItem = (
      id: string,
      patch: Partial<{ status: "queued" | "processing" | "done" | "failed"; error?: string }>,
    ) => {
      setEnhanceQueue((prev) =>
        prev.map((item) => (item.imageId === id ? { ...item, ...patch } : item)),
      );
    };

    for (let i = 0; i < pending.length; i += CONCURRENCY) {
      const batch = pending.slice(i, i + CONCURRENCY);
      await Promise.all(
        batch.map(async (img) => {
          updateQueueItem(img.id, { status: "processing" });
          try {
            const res = await fetch(`/api/walkthrough/images/${img.id}/enhance`, { method: "POST" });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error ?? "Enhancement failed");
            updateQueueItem(img.id, { status: "done" });
            done += 1;
          } catch (err) {
            failed += 1;
            updateQueueItem(img.id, {
              status: "failed",
              error: err instanceof Error ? err.message : "Failed",
            });
          }
          setEnhanceProgress({ done, total: pending.length, failed });
        }),
      );
      await load();
    }

    setEnhancing(false);
    if (failed === 0) {
      toast.success(`Enhanced ${done} images — ready for scene planning`);
      setStep("scenes");
    } else {
      toast.warning(`Enhanced ${done}/${pending.length} — ${failed} failed. Retry or use originals.`);
    }
  }

  async function approveImage(id: string, status: "approved" | "rejected" | "skipped") {
    await fetch(`/api/walkthrough/images/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ enhancement_status: status, approved_by_user: status === "approved" }),
    });
    await load();
  }

  async function planScenes() {
    if (!images.length) return toast.error("Upload images first");
    setPlanning(true);
    try {
      await prepareImagesForPlanning();
      const res = await fetch("/api/walkthrough/plan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ experience_id: experienceId, video_mode: videoGenerationMode }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Scene planning failed");
      if (data.flow_warnings?.length) {
        data.flow_warnings.forEach((w: string) => toast.warning(w));
      }
      const count = data.scenes?.length ?? 0;
      if (!count) throw new Error("No scenes were created — check your images and try again");
      toast.success(`Created ${count} scenes — generating Veo motion clips`);
      await load();
      setStep("motion");
      setGeneratingMotion(true);
      const motionRes = await fetch("/api/walkthrough/video/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ experience_id: experienceId, video_mode: videoGenerationMode }),
      });
      const motionData = await motionRes.json();
      if (motionRes.ok) {
        toast.success(`Queued ${motionData.queued ?? 0} Veo video jobs`);
        startVideoPolling();
      } else {
        toast.warning(motionData.error ?? "Scene plan saved — queue motion manually");
        setGeneratingMotion(false);
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Scene planning failed");
    } finally {
      setPlanning(false);
    }
  }

  async function reorderScenes(ordered: WalkthroughScene[]) {
    setScenes(ordered);
    await fetch("/api/walkthrough/scenes", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ experience_id: experienceId, scene_ids: ordered.map((s) => s.id) }),
    });
    await fetch(`/api/walkthrough/checklist/${experienceId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ scene_order_approved: true }),
    });
    await load();
  }

  async function setSceneMotion(sceneId: string, motionType: string) {
    const scene = scenes.find((s) => s.id === sceneId);
    const veoPrompt = scene
      ? veoPromptForMotion(scene.room_type ?? "room", scene.title, motionType as WalkthroughMotionType)
      : undefined;
    await fetch(`/api/walkthrough/scenes/${sceneId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ motion_type: motionType, ...(veoPrompt ? { veo_prompt: veoPrompt } : {}) }),
    });
    await load();
  }

  async function publish() {
    if (!canPublish) {
      return toast.error("Complete the readiness checklist before publishing");
    }
    setPublishing(true);
    try {
      const res = await fetch(`/api/experiences/${experienceId}/publish`, { method: "POST" });
      const data = await res.json();
      if (!res.ok) return toast.error(data.error ?? "Publish failed");
      toast.success(`Published: ${data.publishedUrl}`);
      setExperienceStatus("published");
      setPublishedUrl(data.publishedUrl ?? null);
      if (data.slug) setExperienceSlug(data.slug);
      await load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Publish failed");
    } finally {
      setPublishing(false);
    }
  }

  async function markChecklistFlag(flag: "ai_tested" | "viewer_previewed") {
    await fetch(`/api/walkthrough/checklist/${experienceId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ [flag]: true }),
    });
    await load();
  }

  async function openPreview() {
    try {
      const res = await fetch(`/api/walkthrough/preview/${experienceId}`, { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Preview failed");

      const path = data.previewUrl ?? `/walkthrough/${data.slug ?? slug ?? experienceId}?preview=1`;
      const url = path.startsWith("http") ? path : `${window.location.origin}${path}`;
      const opened = window.open(url, "_blank", "noopener,noreferrer");
      if (!opened) {
        toast.error("Pop-up blocked — allow pop-ups to preview in a new tab", { description: url });
        return;
      }

      await markChecklistFlag("viewer_previewed");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Preview failed");
    }
  }

  async function updateSceneVeoPrompt(sceneId: string, veoPrompt: string) {
    await fetch(`/api/walkthrough/scenes/${sceneId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ veo_prompt: veoPrompt }),
    });
    setScenes((prev) => prev.map((s) => (s.id === sceneId ? { ...s, veo_prompt: veoPrompt } : s)));
  }

  async function regenerateSceneMotion(sceneId: string) {
    setRegeneratingSceneId(sceneId);
    const res = await fetch("/api/walkthrough/video/generate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ scene_id: sceneId, force: true, video_mode: videoGenerationMode }),
    });
    const data = await res.json();
    setRegeneratingSceneId(null);
    if (!res.ok) return toast.error(data.error ?? "Regenerate failed");
    toast.success("Motion regeneration queued");
    setGeneratingMotion(true);
    startVideoPolling();
    await load();
  }

  const wizardSteps = VIDEO_WALKTHROUGH_ANNOTATIONS_ENABLED
    ? WALKTHROUGH_WIZARD_STEPS
    : WALKTHROUGH_WIZARD_STEPS.filter((s) => s.id !== "pins");

  const stepIndex = wizardSteps.findIndex((s) => s.id === step);

  return (
    <div className="wt-studio">
      <header className="wt-header">
        <div>
          <h1 className="text-lg font-semibold">Property Walkthrough</h1>
          <p className="text-sm text-muted-foreground">Upload listing photos → Gemini plans the tour → Veo 3.1 Fast or Lite builds scroll-controlled video motion</p>
        </div>
        <div className="wt-btn-stack sm:flex-row">
          <Button variant="outline" size="sm" className="min-h-[44px]" onClick={openPreview}>
            <ExternalLink className="mr-1 h-4 w-4" /> Preview Experience
          </Button>
          <Button size="sm" className="min-h-[44px]" onClick={publish} disabled={!canPublish || publishing}>
            {publishing ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : null}
            Publish Walkthrough
          </Button>
        </div>
      </header>

      <nav className="wt-steps">
        {wizardSteps.map((s, i) => (
          <button
            key={s.id}
            type="button"
            className="wt-step"
            data-active={step === s.id}
            data-done={i < stepIndex}
            onClick={() => setStep(s.id)}
          >
            {s.label}
          </button>
        ))}
      </nav>

      <div className="wt-body">
        {step === "upload" && (
          <div className="space-y-4">
            <div className="wt-card">
              <h2 className="font-medium">Add listing photos</h2>
              <p className="mt-1 text-sm text-muted-foreground">Upload 1–35 property photos (Zillow-style listing images). Gemini 3.5 Flash maps room-by-room transitions; Veo turns each into a motion clip.</p>
              <div className="mt-4">
                <label className="flex cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed border-zinc-300 bg-zinc-50 px-6 py-10 hover:bg-zinc-100">
                  <Upload className="mb-2 h-8 w-8 text-zinc-400" />
                  <span className="text-sm font-medium">Drop images or click to upload</span>
                  <span className="mt-1 text-xs text-muted-foreground">JPG, PNG, WebP — up to 35 images</span>
                  <input
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    multiple
                    className="hidden"
                    disabled={uploading || images.length >= 35}
                    onChange={(e) => {
                      void onFilesSelected(e.target.files);
                      e.target.value = "";
                    }}
                  />
                </label>
              </div>
              <p className="mt-2 text-xs text-muted-foreground">{images.length} / 35 images</p>
              {uploadQueue.length > 0 && (
                <ul className="wt-upload-queue">
                  {uploadQueue.map((item) => (
                    <li key={item.clientId} className="wt-upload-queue-item" data-status={item.status}>
                      <div className="wt-upload-queue-meta">
                        <span className="wt-upload-queue-name">{item.fileName}</span>
                        <span className="wt-upload-queue-status">
                          {item.status === "queued" && "Queued"}
                          {item.status === "uploading" && `${item.progress}%`}
                          {item.status === "done" && "Done"}
                          {item.status === "failed" && (item.error ?? "Failed")}
                        </span>
                      </div>
                      <div className="wt-upload-progress-track">
                        <div
                          className="wt-upload-progress-bar"
                          style={{
                            width: item.status === "done" ? "100%" : `${item.progress}%`,
                          }}
                        />
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>
            {images.length > 0 && (
              <div className="wt-grid-2">
                {images.map((img) => (
                  <div key={img.id} className="wt-image-card">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={img.original_image_url} alt={img.file_name} />
                    <p className="truncate p-2 text-xs text-white/90">{img.file_name}</p>
                    {img.upload_status === "failed" && (
                      <p className="flex items-center gap-1 px-2 pb-2 text-xs text-red-300">
                        <XCircle className="h-3.5 w-3.5" /> Upload failed
                      </p>
                    )}
                  </div>
                ))}
              </div>
            )}
            <Button onClick={() => setStep("enhance")} disabled={!images.length || uploading}>
              Continue to improve quality <Upload className="ml-2 h-4 w-4" />
            </Button>
          </div>
        )}

        {step === "enhance" && (
          <div className="space-y-4">
            <div className="wt-card flex flex-wrap items-center justify-between gap-4">
              <div>
                <h2 className="font-medium">Improve image quality</h2>
                <p className="text-sm text-muted-foreground">
                  Vertex Gemini improves lighting, sharpness, and color for each listing photo without changing the property layout.
                </p>
                {enhanceProgress.total > 0 && (
                  <p className="mt-2 text-xs text-muted-foreground">
                    {enhancing
                      ? `Enhancing ${enhanceProgress.done + 1}–${Math.min(enhanceProgress.done + 2, enhanceProgress.total)} of ${enhanceProgress.total}…`
                      : `${enhanceProgress.done}/${enhanceProgress.total} enhanced${enhanceProgress.failed ? ` · ${enhanceProgress.failed} failed` : ""}`}
                  </p>
                )}
              </div>
              <Button onClick={enhanceAll} disabled={enhancing || !images.length}>
                {enhancing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Sparkles className="mr-2 h-4 w-4" />}
                {enhancing ? "Enhancing…" : `Enhance all (${images.filter((i) => i.enhancement_status === "pending" || i.enhancement_status === "failed").length || images.length})`}
              </Button>
            </div>
            {enhanceQueue.length > 0 && (
              <ul className="wt-upload-queue">
                {enhanceQueue.map((item) => (
                  <li key={item.imageId} className="wt-upload-queue-item" data-status={item.status}>
                    <div className="wt-upload-queue-meta">
                      <span className="wt-upload-queue-name">{item.fileName}</span>
                      <span className="wt-upload-queue-status">
                        {item.status === "queued" && "Queued"}
                        {item.status === "processing" && "Enhancing…"}
                        {item.status === "done" && "Done"}
                        {item.status === "failed" && (item.error ?? "Failed")}
                      </span>
                    </div>
                    <div className="wt-upload-progress-track">
                      <div
                        className="wt-upload-progress-bar"
                        style={{ width: item.status === "done" ? "100%" : item.status === "processing" ? "40%" : "0%" }}
                      />
                    </div>
                  </li>
                ))}
              </ul>
            )}
            <div className="wt-grid-2">
              {images.map((img) => (
                <div key={img.id} className="wt-card space-y-2">
                  <div className="grid grid-cols-2 gap-2">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={img.original_image_url} alt="Before" className="rounded-md aspect-video object-cover" />
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={img.enhanced_image_url ?? img.original_image_url} alt="After" className="rounded-md aspect-video object-cover" />
                  </div>
                  <p className="text-xs text-muted-foreground">Status: {img.enhancement_status}</p>
                  <div className="flex gap-2">
                    <Button size="sm" variant="outline" onClick={() => approveImage(img.id, "approved")}>Accept</Button>
                    <Button size="sm" variant="outline" onClick={() => approveImage(img.id, "skipped")}>Use original</Button>
                    <Button size="sm" variant="ghost" disabled={enhancing} onClick={async () => {
                      await fetch(`/api/walkthrough/images/${img.id}/enhance`, { method: "POST" });
                      await load();
                    }}>Regenerate</Button>
                  </div>
                </div>
              ))}
            </div>
            <Button onClick={async () => {
              await prepareImagesForPlanning();
              setStep("scenes");
            }}>Continue to create scenes</Button>
          </div>
        )}

        {step === "scenes" && (
          <div className="space-y-4">
            <div className="wt-card">
              <h2 className="font-medium">Analyze & plan scenes</h2>
              <p className="text-sm text-muted-foreground">AI names each room, suggests motion, and builds your walkthrough flow.</p>
              <Button className="mt-4" onClick={planScenes} disabled={planning || !images.length}>
                {planning ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Wand2 className="mr-2 h-4 w-4" />}
                {planning ? "Analyzing images…" : "Generate Walkthrough"}
              </Button>
              {!images.length && (
                <p className="mt-2 text-xs text-amber-700">Upload at least one image to continue.</p>
              )}
            </div>
            {scenes.length > 0 && (
              <div className="wt-card space-y-3">
                <h3 className="text-sm font-medium">Scene plan preview</h3>
                <div className="wt-scene-grid">
                  {scenes.map((s) => {
                    const meta = getSceneClassification(s);
                    return (
                    <div key={s.id} className="wt-scene-preview-card">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={s.thumbnail_url ?? s.image_url} alt={s.title} />
                      <div className="wt-scene-preview-meta">
                        <strong>{s.title}</strong>
                        <small>{roomTypeLabel(s.room_type)} · {meta.needs_review ? "Needs Review" : formatConfidence(meta.classification_confidence)}</small>
                      </div>
                    </div>
                    );
                  })}
                </div>
                <div className="flex flex-wrap gap-2 border-t pt-3">
                  <Button variant="outline" onClick={openPreview}>
                    <ExternalLink className="mr-2 h-4 w-4" /> Preview now
                  </Button>
                  <Button onClick={publish} disabled={!canPublish}>
                    Publish walkthrough
                  </Button>
                  <Button variant="ghost" onClick={() => setStep("arrange")}>Customize order</Button>
                </div>
              </div>
            )}
            <Button onClick={() => setStep("arrange")} disabled={!scenes.length}>Arrange walkthrough</Button>
          </div>
        )}

        {step === "arrange" && (
          <div className="space-y-4">
            <div className="wt-card">
              <h2 className="font-medium">Arrange walkthrough</h2>
              <p className="text-sm text-muted-foreground">
                Drag to reorder — exterior first, then living, kitchen, bedrooms. Edit names or exclude scenes before motion.
              </p>
            </div>
            {checklist?.warnings?.map((w) => (
              <p key={w} className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">{w}</p>
            ))}
            {scenes.length === 0 ? (
              <p className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
                No scenes yet — go back to Analyze & plan scenes and generate your walkthrough.
              </p>
            ) : (
              <WalkthroughArrangePanel
                scenes={scenes}
                onScenesChange={setScenes}
                onReorder={reorderScenes}
              />
            )}
            <Button onClick={() => setStep("motion")} disabled={!scenes.some((s) => getSceneClassification(s).included !== false)}>
              Confirm room order
            </Button>
          </div>
        )}

        {step === "motion" && (
          <div className="space-y-4">
            <div className="wt-card space-y-3">
              <div>
                <h2 className="font-medium">Generation mode</h2>
                <p className="text-sm text-muted-foreground">
                  Choose speed vs quality before generating motion clips. The selected model is used for every job — no automatic fallback.
                </p>
              </div>
              <div className="flex flex-col gap-3 sm:flex-row">
                {(Object.keys(VEO_GENERATION_MODES) as VeoGenerationMode[]).map((mode) => {
                  const cfg = VEO_GENERATION_MODES[mode];
                  const active = videoGenerationMode === mode;
                  return (
                    <button
                      key={mode}
                      type="button"
                      disabled={generatingMotion}
                      onClick={() => setVideoGenerationMode(mode)}
                      className={`flex-1 rounded-xl border px-4 py-3 text-left transition-all ${
                        active
                          ? "border-primary bg-primary/12 text-foreground shadow-[0_0_0_1px_color-mix(in_srgb,var(--primary)_35%,transparent),0_4px_14px_color-mix(in_srgb,var(--primary)_18%,transparent)]"
                          : "border-border bg-background hover:border-primary/40 hover:bg-primary/5"
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-semibold">{cfg.label}</p>
                        {cfg.recommended && (
                          <span className="rounded-full bg-primary/15 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-primary">
                            Recommended
                          </span>
                        )}
                      </div>
                      <p className="mt-1 text-xs text-muted-foreground">{cfg.tagline}</p>
                      <p className="mt-1 text-xs font-medium text-foreground/80">{cfg.description}</p>
                    </button>
                  );
                })}
              </div>
            </div>
            {generatingMotion && videoProgress && (() => {
              void videoTimerTick;
              const startedMs = videoProgress.startedAt
                ? new Date(videoProgress.startedAt).getTime()
                : pollStartedAtRef.current ?? Date.now();
              const elapsedMs = Date.now() - startedMs;
              const etaSec = videoProgress.estimatedRemainingSeconds;
              const etaMs = typeof etaSec === "number" && etaSec > 0 ? etaSec * 1000 : null;
              const modeTag = videoGenerationMode === "fast" ? "Fast generation" : "Quality generation";
              const veoLabel = VEO_GENERATION_MODES[videoGenerationMode].description;
              const retrying = videoJobs.some((j) => j.status === "retrying");
              const stageLabel =
                videoProgress.stage === "queued" ? "Queued"
                : videoProgress.stage === "submitted" ? "Submitted"
                : videoProgress.stage === "generating" ? "Generating"
                : videoProgress.stage === "polling" ? "Polling"
                : videoProgress.stage === "completed" ? "Completed"
                : "Processing";
              return (
              <div className="wt-card space-y-2 border-primary/20 bg-primary/5">
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <Loader2 className="h-4 w-4 animate-spin text-primary" />
                    <span className="text-sm font-medium">
                      {stageLabel} · {veoLabel}
                      {retrying ? " · Retrying" : ""}
                    </span>
                  </div>
                  <span className="text-xs text-muted-foreground">
                    {videoProgress.completed}/{videoProgress.total} clips
                  </span>
                </div>
                <p className="text-sm text-foreground">
                  {modeTag} · {formatTimerMmSs(elapsedMs)} elapsed
                  {etaMs
                    ? videoProgress.estimateIsApproximate
                      ? ` · ~${formatTimerMmSs(etaMs)} remaining (estimate may vary)`
                      : ` · ~${formatTimerMmSs(etaMs)} remaining`
                    : " · estimated time may vary"}
                </p>
                <div className="h-1.5 overflow-hidden rounded-full bg-muted">
                  <div
                    className="h-full rounded-full bg-primary transition-all duration-500"
                    style={{ width: `${videoProgress.total ? Math.round((videoProgress.completed / videoProgress.total) * 100) : 0}%` }}
                  />
                </div>
                <p className="text-xs text-muted-foreground">
                  Veo clips often take several minutes each. Generation runs in the background — you can leave this page and return later.
                </p>
              </div>
              );
            })()}
            {!generatingMotion && videoCompletionSummary && (
              <div className="wt-card border-emerald-500/20 bg-emerald-500/5">
                <p className="text-sm font-medium text-emerald-800 dark:text-emerald-200">{videoCompletionSummary}</p>
              </div>
            )}
            <div className="wt-card flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="font-medium">Generate video motion</h2>
                <p className="text-sm text-muted-foreground">
                  Each scene becomes a short motion clip via {VEO_GENERATION_MODES[videoGenerationMode].description}.
                  {scenes.length > 0 && ` ${motionReadyCount}/${scenes.length} clips ready.`}
                </p>
              </div>
              <Button
                disabled={generatingMotion || !scenes.length}
                onClick={async () => {
                  setGeneratingMotion(true);
                  const res = await fetch("/api/walkthrough/video/generate", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ experience_id: experienceId, video_mode: videoGenerationMode }),
                  });
                  const data = await res.json();
                  if (!res.ok) {
                    setGeneratingMotion(false);
                    return toast.error(data.error ?? "Motion generation failed");
                  }
                  toast.success(`Queued ${data.queued ?? data.submitted ?? 0} motion jobs — Veo runs in background`);
                  startVideoPolling();
                }}
              >
                {generatingMotion ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Clapperboard className="mr-2 h-4 w-4" />}
                {generatingMotion ? "Generating motion…" : "Generate all motion"}
              </Button>
            </div>
            {scenes.map((s) => {
              const job = videoJobs.find((j) => j.scene_id === s.id);
              const pollResult = job?.id ? lastPollResults.find((r) => r.jobId === job.id) : undefined;
              const validation = job?.validation_result ?? pollResult?.validation;
              const sceneVideoUrl = resolveSceneVideo(s);
              const status = sceneVideoUrl ? "completed" : job?.status ?? s.scene_status ?? "pending";
              const isValidationFailed = validation && !validation.passed && !sceneVideoUrl;
              return (
              <div key={s.id} className="wt-card">
                <div className="mb-2 flex items-center justify-between gap-2">
                  <p className="font-medium">{s.title}</p>
                  <span className="wt-motion-status" data-status={isValidationFailed ? "failed" : status}>
                    {sceneVideoUrl
                      ? isValidationFailed ? "Motion ready (review)"
                      : "Motion ready"
                      : isValidationFailed
                        ? "Validation failed"
                        : status === "processing" || status === "retrying"
                          ? status === "retrying" ? "Retrying…" : "Generating…"
                          : status === "failed"
                            ? "Generation failed"
                            : "Queued"}
                  </span>
                </div>
                {(status === "failed" || isValidationFailed) && job?.error && (
                  <p className="mb-2 text-xs text-destructive">{job.error}</p>
                )}
                {validation && (
                  <div className={`mb-2 rounded-md border px-3 py-2 text-xs ${validation.passed ? "border-emerald-500/30 bg-emerald-500/5" : "border-amber-500/30 bg-amber-500/5"}`}>
                    <p className="font-medium">
                      AI quality check · {Math.round(validation.score * 100)}% · {validation.passed ? "Passed" : "Failed"}
                    </p>
                    <p className="mt-1 text-muted-foreground">{validation.summary}</p>
                    {validation.issues.length > 0 && (
                      <ul className="mt-1 list-inside list-disc text-muted-foreground">
                        {validation.issues.map((issue) => (
                          <li key={issue}>{issue}</li>
                        ))}
                      </ul>
                    )}
                    {!validation.passed && (
                      <p className="mt-1 text-muted-foreground">
                        Retry with the same {VEO_GENERATION_MODES[videoGenerationMode].description} model to regenerate.
                      </p>
                    )}
                  </div>
                )}
                {job?.generation_duration_ms != null && job.generation_duration_ms > 0 && (
                  <p className="mb-2 text-xs text-muted-foreground">
                    Video generated in {formatDurationMinSec(job.generation_duration_ms)}
                  </p>
                )}
                {sceneVideoUrl && (
                  <video src={sceneVideoUrl} className="mb-2 w-full rounded-md" controls muted playsInline />
                )}
                <div className="mb-2">
                  <label className="text-xs font-medium text-muted-foreground">Veo motion prompt</label>
                  <textarea
                    className="mt-1 w-full rounded-md border bg-background px-3 py-2 text-xs"
                    rows={3}
                    value={s.veo_prompt ?? ""}
                    onChange={(e) => setScenes((prev) => prev.map((sc) => sc.id === s.id ? { ...sc, veo_prompt: e.target.value } : sc))}
                    onBlur={(e) => updateSceneVeoPrompt(s.id, e.target.value)}
                    placeholder="Conservative property-safe motion prompt…"
                  />
                </div>
                <div className="mb-2 flex flex-wrap gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={regeneratingSceneId === s.id || generatingMotion}
                    onClick={() => regenerateSceneMotion(s.id)}
                  >
                    {regeneratingSceneId === s.id ? <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" /> : null}
                    Regenerate motion
                  </Button>
                </div>
                <div className="flex flex-wrap gap-2">
                  {WALKTHROUGH_MOTION_PRESETS.map((m) => (
                    <button
                      key={m.type}
                      type="button"
                      className={`rounded-md border px-3 py-1.5 text-xs ${s.motion_type === m.type ? "border-emerald-500 bg-emerald-50 text-emerald-800" : ""}`}
                      onClick={() => setSceneMotion(s.id, m.type)}
                    >
                      {m.label}
                    </button>
                  ))}
                </div>
              </div>
            );})}
            {videoJobs.length > 0 && (
              <p className="text-xs text-muted-foreground">
                Jobs: {videoJobs.filter((j) => j.status === "completed").length} completed · {videoJobs.filter((j) => j.status === "failed").length} failed
              </p>
            )}
            <Button onClick={() => setStep("rag")}>Add property knowledge</Button>
          </div>
        )}

        {VIDEO_WALKTHROUGH_ANNOTATIONS_ENABLED && step === "pins" && (
          <div className="space-y-4">
            <div className="wt-card">
              <h2 className="font-medium">Add annotation layers</h2>
              <p className="text-sm text-muted-foreground">Place pins on each scene. AI suggested pins from planning appear below — click to edit or add more.</p>
            </div>
            {scenes.length === 0 ? (
              <p className="text-sm text-muted-foreground">Create scenes first before adding annotations.</p>
            ) : (
              <>
                <div className="wt-scene-tabs">
                  {scenes.map((s) => (
                    <button
                      key={s.id}
                      type="button"
                      className="wt-scene-tab"
                      data-active={activePinSceneId === s.id}
                      onClick={() => setActivePinSceneId(s.id)}
                    >
                      {s.title}
                    </button>
                  ))}
                </div>
                {activePinSceneId && (() => {
                  const activeScene = scenes.find((s) => s.id === activePinSceneId);
                  if (!activeScene) return null;
                  const anns = activeScene.walkthrough_annotations ?? [];
                  return (
                    <WalkthroughAnnotationEditor
                      scene={activeScene}
                      annotations={anns}
                      onAnnotationsChange={(next) => {
                        setScenes((prev) => prev.map((s) => (
                          s.id === activeScene.id ? { ...s, walkthrough_annotations: next } : s
                        )));
                      }}
                    />
                  );
                })()}
              </>
            )}
            <Button onClick={() => setStep("rag")} disabled={!scenes.length}>Add property knowledge</Button>
          </div>
        )}

        {step === "rag" && (
          <div className="space-y-4">
            <WalkthroughPropertyKnowledgePanel
              propertyId={propertyId}
              experienceId={experienceId}
              onKnowledgeChange={setStructuredKnowledge}
            />
            <div className="flex flex-wrap gap-2">
              <Button onClick={openPreview}>
                <ExternalLink className="mr-2 h-4 w-4" /> Preview walkthrough
              </Button>
              <Button variant="outline" onClick={() => setStep("preview")}>Continue to preview step</Button>
              <Button variant="ghost" onClick={publish} disabled={!canPublish}>Publish now</Button>
            </div>
          </div>
        )}

        {step === "preview" && (
          <div className="space-y-4">
            <div className="wt-card">
              <h2 className="font-medium">Test scroll-controlled preview</h2>
              <p className="text-sm text-muted-foreground">Open the hosted walkthrough — scroll scrubs each Veo clip room-by-room. Toggle Walk Mode to jump between rooms.</p>
              <Button className="mt-4" onClick={openPreview}>
                <ExternalLink className="mr-2 h-4 w-4" /> Open preview
              </Button>
            </div>
            <div className="wt-card wt-voice-settings-card space-y-3">
              <WalkthroughBrainSettings
                value={brainProvider}
                onChange={saveBrainProvider}
                disabled={savingBrainProvider}
                title="Property AI brain"
                description="Gemini 3.5 Flash (Native) or Vertex Cloud — saved to Supabase and used by the buyer walkthrough."
              />
            </div>
            <div className="wt-card wt-voice-settings-card space-y-3">
              <WalkthroughOwnerVoiceSettings
                value={viewerVoiceProfile}
                onChange={saveViewerVoiceProfile}
                disabled={savingVoiceProfile}
                experienceId={experienceId}
                organizationId={scenes[0]?.organization_id ?? images[0]?.organization_id}
                viewerConfig={viewerConfig}
                onViewerConfigChange={setViewerConfig}
              />
            </div>
            <div className="wt-card space-y-3">
              <h3 className="text-sm font-medium">AI voice test (studio)</h3>
              <p className="text-xs text-muted-foreground">
                Test the saved ElevenLabs voice with mic or text — uses your voice, language, and tone settings above.
              </p>
              {(scenes[0]?.organization_id ?? images[0]?.organization_id) ? (
                <WalkthroughVoiceTest
                  organizationId={scenes[0]?.organization_id ?? images[0]!.organization_id}
                  propertyId={propertyId}
                  experienceId={experienceId}
                  activeSceneId={scenes[0]?.id}
                  lockedVoiceProfile={viewerVoiceProfile}
                  brainProvider={brainProvider}
                  onAnswer={(answer) => {
                    setAiTestReply(answer);
                    markChecklistFlag("ai_tested");
                  }}
                  onCommand={(cmd) => setAiTestCommand(cmd)}
                />
              ) : (
                <p className="text-sm text-muted-foreground">Generate scenes first to test the AI voice agent.</p>
              )}
              {aiTestCommand && aiTestCommand !== "NONE" && (
                <p className="text-xs text-muted-foreground">AI command: {aiTestCommand}</p>
              )}
            </div>
            {checklist && (
              <div className="wt-card wt-checklist">
                <h3 className="mb-2 font-medium">Readiness checklist</h3>
                {[
                  ["images_uploaded", "Images uploaded"],
                  ["images_enhanced", "Images enhanced"],
                  ["scenes_created", "Scenes created"],
                  ["motion_added", "Motion configured"],
                  ["motion_videos_generated", "Veo motion clips ready (optional)"],
                  ...(VIDEO_WALKTHROUGH_ANNOTATIONS_ENABLED ? [["annotations_added", "Annotations added"] as const] : []),
                  ["property_rag_added", "Property knowledge added"],
                  ["ai_tested", "AI agent tested (optional)"],
                  ["viewer_previewed", "Preview opened (optional)"],
                  ["ready_to_publish", "Ready to publish"],
                ].map(([key, label]) => (
                  <div key={key} className="wt-check-item" data-done={checklist[key as keyof WalkthroughChecklist] ? "true" : "false"}>
                    <Check className="h-4 w-4" /> {label}
                  </div>
                ))}
              </div>
            )}
            <PropertyKnowledgeSummary
              propertyId={propertyId}
              experienceId={experienceId}
              knowledge={structuredKnowledge}
              onKnowledgeChange={setStructuredKnowledge}
              mode="preview"
              title="AI assistant knowledge"
              description="Scene descriptions are included automatically. Optional property details appear here when saved."
              showToggles={false}
            />
            <Button onClick={() => setStep("publish")} disabled={!canPublish}>Ready to publish</Button>
          </div>
        )}

        {step === "publish" && (
          <div className="space-y-4">
            {scenes.length > 0 && (
              <div className="wt-card overflow-hidden p-0">
                <div className="border-b px-4 py-3">
                  <h2 className="font-medium">Walkthrough preview</h2>
                  <p className="text-sm text-muted-foreground">
                    {isPublished
                      ? "This is how buyers will see your published walkthrough."
                      : "Studio preview — buyers get this link after you publish."}
                  </p>
                </div>
                <iframe
                  title="Walkthrough preview"
                  src={studioPreviewPath}
                  className="h-[min(70vh,720px)] w-full border-0 bg-black"
                  allow="microphone; autoplay"
                />
              </div>
            )}
            <div className="wt-card space-y-4 text-center">
              <h2 className="text-xl font-semibold">Publish walkthrough</h2>
              <p className="text-muted-foreground break-all">
                {isPublished ? "Live share link:" : "Preview link (works now):"}{" "}
                <a href={shareUrl} target="_blank" rel="noopener noreferrer" className="text-primary underline">
                  {shareUrl}
                </a>
              </p>
              {!isPublished && canPublish && (
                <p className="text-sm text-muted-foreground">
                  After publishing, buyers use the same URL without <code className="text-xs">?preview=1</code>.
                </p>
              )}
              {appBase.includes("localhost") && (
                <p className="text-sm text-amber-700">
                  Set <code className="text-xs">NEXT_PUBLIC_APP_URL</code> to your Vercel domain in production so published links point to the live site.
                </p>
              )}
              <p className="text-sm text-muted-foreground">
                Images with scroll motion work immediately. Veo video clips are optional — add them later from the Motion step.
              </p>
              {!canPublish && (
                <p className="text-sm text-amber-700">
                  Upload photos and generate scenes before publishing
                  {images.length > 0 || scenes.length > 0
                    ? ` (${images.length} image${images.length === 1 ? "" : "s"}, ${scenes.length} scene${scenes.length === 1 ? "" : "s"} loaded).`
                    : "."}
                </p>
              )}
              <div className="flex flex-wrap justify-center gap-2">
                <Button variant="outline" onClick={openPreview}>
                  <ExternalLink className="mr-2 h-4 w-4" /> Preview first
                </Button>
                <Button size="lg" onClick={publish} disabled={!canPublish || publishing}>
                  {publishing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                  Publish Walkthrough
                </Button>
              </div>
            </div>
            <div className="wt-card wt-voice-settings-card">
              <WalkthroughBrainSettings
                value={brainProvider}
                onChange={saveBrainProvider}
                disabled={savingBrainProvider}
                title="Property AI brain"
                description="Confirm which Gemini model powers buyer Q&A before going live. Saved to Supabase viewer_config."
              />
            </div>
            <PropertyKnowledgeSummary
              propertyId={propertyId}
              experienceId={experienceId}
              knowledge={structuredKnowledge}
              mode="preview"
              title="Final AI knowledge review"
              description="Confirm this knowledge base before going live."
              showToggles
            />
          </div>
        )}
      </div>
    </div>
  );
}
