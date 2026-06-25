"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { StreetViewOverlay } from "@/components/capture/street-view-overlay";
import { CapturePreview } from "@/components/capture/capture-preview";
import {
  SPHERE_CAPTURE,
  VIDEO_CAPTURE,
  bucketForYaw,
  buildCoverage,
  computeQualityReport,
  coverageStats,
  isVideoCaptureSupported,
  relativeYaw,
  type CapturePhase,
  type CapturedSphereFrame,
  type CoverageBucket,
} from "@/lib/capture/capture-protocol";
import { CaptureEngine } from "@/lib/capture/capture-engine";
import { playShutter, playSuccess } from "@/lib/capture/capture-audio";
import { stitchInBackground } from "@/lib/capture/stitch-worker";
import type { PanoramaConfig } from "@/lib/capture/pannellum-stitch";
import { useDeviceOrientation } from "@/lib/capture/use-device-orientation";
import { captureVideoFrame } from "@/lib/capture/video-frame";
import { VideoCaptureRecorder } from "@/lib/capture/video-recorder";
import { extractFramesFromVideo } from "@/lib/capture/frame-extractor";
import { ArrowLeft, Sparkles, Video } from "lucide-react";
import { toast } from "sonner";

const MIN_RECORDING_MS = 8_000;
const MIN_EXTRACTED_FRAMES = 12;

export function GuidedCameraCapture({
  roomName,
  roomId,
  propertyId,
  progress,
  total,
  onComplete,
  onBack,
}: {
  roomName: string;
  roomId: string;
  propertyId: string;
  progress: number;
  total: number;
  onComplete: () => void;
  onBack: () => void;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const originHeadingRef = useRef<number | null>(null);
  const engineRef = useRef(new CaptureEngine());
  const recorderRef = useRef(new VideoCaptureRecorder());
  const finishingRef = useRef(false);
  const framesRef = useRef<CapturedSphereFrame[]>([]);
  const photoBusyRef = useRef(false);

  const [videoMode, setVideoMode] = useState(false);
  const [phase, setPhase] = useState<CapturePhase>("setup");
  const [countdown, setCountdown] = useState(0);
  const [buckets, setBuckets] = useState<CoverageBucket[]>(() => buildCoverage());
  const [frames, setFrames] = useState<CapturedSphereFrame[]>([]);
  const [hint, setHint] = useState("Stand in the center. Hold phone upright.");
  const [flash, setFlash] = useState(false);
  const [manualMode, setManualMode] = useState(false);
  const [saving, setSaving] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [previewBlob, setPreviewBlob] = useState<Blob | null>(null);
  const [panoramaConfig, setPanoramaConfig] = useState<PanoramaConfig | null>(null);
  const [rotationSpeed, setRotationSpeed] = useState(0);
  const [elapsedMs, setElapsedMs] = useState(0);

  const orientation = useDeviceOrientation();
  const stats = coverageStats(buckets);
  const quality = computeQualityReport(buckets, frames);

  const currentYaw =
    orientation.heading != null && originHeadingRef.current != null
      ? relativeYaw(orientation.heading, originHeadingRef.current)
      : null;

  const startCamera = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: { ideal: "environment" },
          width: { ideal: 3840 },
          height: { ideal: 2160 },
          frameRate: { ideal: 30 },
        },
        audio: false,
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
    } catch {
      toast.error("Allow camera access to capture this room.");
    }
  }, []);

  useEffect(() => {
    setVideoMode(isVideoCaptureSupported());
    startCamera();
    const recorder = recorderRef.current;
    return () => {
      recorder.cancel();
      streamRef.current?.getTracks().forEach((t) => t.stop());
    };
  }, [startCamera]);

  // Elapsed-time ticker while recording
  useEffect(() => {
    if (phase !== "capturing" || !videoMode) return;
    const interval = setInterval(() => {
      setElapsedMs(recorderRef.current.elapsedMs);
    }, 250);
    return () => clearInterval(interval);
  }, [phase, videoMode]);

  async function startCountdown() {
    const motionOk = await orientation.requestAccess();
    setManualMode(!motionOk);
    setPhase("countdown");
    for (let i = 3; i >= 1; i--) {
      setCountdown(i);
      await new Promise((r) => setTimeout(r, 700));
    }
    setCountdown(0);
    originHeadingRef.current = orientation.heading ?? 0;
    engineRef.current.reset();
    finishingRef.current = false;
    framesRef.current = [];
    setBuckets(buildCoverage());
    setFrames([]);
    setElapsedMs(0);

    let recordingStarted = false;
    if (videoMode && streamRef.current) {
      try {
        recorderRef.current.start(streamRef.current);
        recordingStarted = true;
      } catch {
        toast.error("Recording unavailable — switching to photo mode");
        setVideoMode(false);
      }
    }

    setPhase("capturing");
    setHint(
      recordingStarted
        ? motionOk
          ? "Recording — turn slowly in a full circle"
          : "Recording — turn slowly, one full circle in ~25 seconds"
        : "Tap Capture as you rotate, every small step",
    );
  }

  const finishRecording = useCallback(async () => {
    if (finishingRef.current || !recorderRef.current.isRecording) return;
    finishingRef.current = true;

    setPhase("processing");
    orientation.stop();
    playShutter();
    if (navigator.vibrate) navigator.vibrate([40, 30, 40]);

    try {
      setHint("Saving video…");
      const recording = await recorderRef.current.stop();

      setHint("Extracting frames… 0%");
      const extracted = await extractFramesFromVideo(
        recording.blob,
        recording.samples,
        recording.durationMs,
        (pct) => setHint(`Extracting frames… ${pct}%`),
      );

      if (extracted.length < MIN_EXTRACTED_FRAMES) {
        toast.error("Not enough usable frames — rotate a full circle and try again");
        retake();
        return;
      }

      framesRef.current = extracted;
      setFrames(extracted);
      setBuckets(() => {
        const next = buildCoverage();
        for (const f of extracted) next[f.bucketIndex] = { ...next[f.bucketIndex], covered: true };
        return next;
      });

      setHint("Building 360° view… 0%");
      const stitchStart = performance.now();
      const result = await stitchInBackground(
        extracted.map((f) => ({
          yaw: f.yaw,
          blob: f.blob,
          exposure: f.exposure,
          pitch: f.devicePitch,
          roll: f.deviceRoll,
        })),
        (pct) => {
          const elapsed = ((performance.now() - stitchStart) / 1000).toFixed(1);
          setHint(`Building 360° view… ${pct}% (${elapsed}s)`);
        },
        { fast: true },
      );
      const url = URL.createObjectURL(result.blob);
      setPreviewBlob(result.blob);
      setPreviewUrl(url);
      setPanoramaConfig(result.config);
      setPhase("preview");
      playSuccess();
    } catch {
      toast.error("Processing failed — try again with slower rotation and better lighting");
      retake();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orientation]);

  // Orientation loop while recording: log timeline + fill coverage ring
  useEffect(() => {
    if (phase !== "capturing" || currentYaw == null) return;

    engineRef.current.push({
      yaw: currentYaw,
      pitch: orientation.pitch ?? 90,
      roll: orientation.roll ?? 0,
      timestamp: Date.now(),
    });
    setRotationSpeed(engineRef.current.rotationSpeed());

    if (videoMode) {
      recorderRef.current.addSample(currentYaw, orientation.pitch ?? 90, orientation.roll ?? 0);
      const idx = bucketForYaw(currentYaw);
      setBuckets((prev) => {
        if (prev[idx]?.covered) return prev;
        const updated = prev.map((b) => (b.index === idx ? { ...b, covered: true } : b));
        if (coverageStats(updated).full) queueMicrotask(() => void finishRecording());
        return updated;
      });
    }
  }, [phase, currentYaw, orientation.pitch, orientation.roll, videoMode, finishRecording]);

  // Hard stop at max recording length
  useEffect(() => {
    if (phase !== "capturing" || !videoMode) return;
    const timer = setTimeout(() => void finishRecording(), VIDEO_CAPTURE.maxDurationMs);
    return () => clearTimeout(timer);
  }, [phase, videoMode, finishRecording]);

  /** Legacy photo fallback — only when MediaRecorder is unsupported. */
  const snapPhotoFallback = useCallback(async () => {
    if (photoBusyRef.current) return;
    const video = videoRef.current;
    if (!video) return;

    photoBusyRef.current = true;
    const captured = await captureVideoFrame(video);
    if (!captured) {
      photoBusyRef.current = false;
      return;
    }
    if (!captured.quality.ok) {
      setHint(captured.quality.issue ?? "Hold steady");
      photoBusyRef.current = false;
      return;
    }

    setFlash(true);
    setTimeout(() => setFlash(false), 120);
    playShutter();

    const yaw = currentYaw ?? (framesRef.current.length * SPHERE_CAPTURE.bucketStep * 2) % 360;
    const frame: CapturedSphereFrame = {
      bucketIndex: bucketForYaw(yaw),
      yaw,
      pitch: 0,
      blob: captured.blob,
      sharpness: captured.quality.sharpness,
      brightness: captured.quality.brightness,
      exposure: captured.quality.brightness,
    };
    const next = [...framesRef.current, frame];
    framesRef.current = next;
    setFrames(next);
    setBuckets((prev) => prev.map((b) => (b.index === frame.bucketIndex ? { ...b, covered: true } : b)));
    setHint("Keep rotating and tapping Capture");
    photoBusyRef.current = false;
  }, [currentYaw]);

  async function processPhotoFallback() {
    const captured = framesRef.current;
    if (captured.length < MIN_EXTRACTED_FRAMES) {
      toast.error(`Capture at least ${MIN_EXTRACTED_FRAMES} photos around the room`);
      return;
    }
    setPhase("processing");
    orientation.stop();
    try {
      const result = await stitchInBackground(
        captured.map((f) => ({ yaw: f.yaw, blob: f.blob, exposure: f.exposure })),
        (pct) => setHint(`Building 360° view… ${pct}%`),
        { fast: true },
      );
      const url = URL.createObjectURL(result.blob);
      setPreviewBlob(result.blob);
      setPreviewUrl(url);
      setPanoramaConfig(result.config);
      setPhase("preview");
      playSuccess();
    } catch {
      toast.error("Stitch failed — try again");
      setPhase("capturing");
    }
  }

  async function uploadFramesBackground(captured: CapturedSphereFrame[]) {
    for (const frame of captured) {
      const form = new FormData();
      form.append("file", new File([frame.blob], `f-${frame.bucketIndex}.jpg`, { type: "image/jpeg" }));
      form.append("propertyId", propertyId);
      const res = await fetch("/api/media/upload", { method: "POST", body: form });
      const asset = await res.json();
      if (!res.ok) continue;
      await fetch(`/api/capture/rooms/${roomId}/frames`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          angle_label: `yaw_${Math.round(frame.yaw)}`,
          image_url: asset.file_url,
          media_asset_id: asset.id,
          sort_order: frame.bucketIndex,
          metadata: { yaw: frame.yaw, sharpness: frame.sharpness, brightness: frame.brightness },
        }),
      });
    }
  }

  async function acceptPreview() {
    if (!previewBlob || !panoramaConfig) return;
    setSaving(true);
    setHint("Uploading to cloud…");

    try {
      const form = new FormData();
      form.append("file", new File([previewBlob], "panorama.jpg", { type: "image/jpeg" }));
      form.append("propertyId", propertyId);
      const uploadRes = await fetch("/api/media/upload", { method: "POST", body: form });
      const asset = await uploadRes.json();

      if (!uploadRes.ok || !asset.file_url) {
        throw new Error(asset.error ?? "Failed to upload panorama to storage");
      }

      setHint("Creating scene…");
      const stitchRes = await fetch(`/api/capture/rooms/${roomId}/stitch`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          stitched_image_url: asset.file_url,
          panorama_config: panoramaConfig,
          initial_yaw: originHeadingRef.current ?? 0,
          initial_pitch: 0,
          extracted_frame_count: framesRef.current.length,
        }),
      });
      const result = await stitchRes.json();

      if (!stitchRes.ok || result.needsRetake) {
        throw new Error(result.job?.error_message ?? "Could not save scene");
      }

      // Source frames upload in background — not required for scene creation
      void uploadFramesBackground(framesRef.current);

      setPhase("complete");
      toast.success(`${roomName} saved to cloud!`);
      onComplete();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Save failed — try again");
      setPhase("preview");
    } finally {
      setSaving(false);
      setHint("");
    }
  }

  function retake() {
    recorderRef.current.cancel();
    finishingRef.current = false;
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setPreviewUrl(null);
    setPreviewBlob(null);
    setPanoramaConfig(null);
    engineRef.current.reset();
    framesRef.current = [];
    setFrames([]);
    setBuckets(buildCoverage());
    setElapsedMs(0);
    setPhase("setup");
    setHint("Stand in the center. Hold phone upright.");
  }

  const elapsedSec = Math.floor(elapsedMs / 1000);
  const canFinish =
    videoMode &&
    elapsedMs >= MIN_RECORDING_MS &&
    (manualMode || stats.pct >= VIDEO_CAPTURE.minCoveragePct);

  if (phase === "preview" && previewUrl && panoramaConfig) {
    return (
      <CapturePreview
        previewUrl={previewUrl}
        panoramaConfig={panoramaConfig}
        quality={quality}
        roomName={roomName}
        onAccept={acceptPreview}
        onRetake={retake}
        saving={saving}
      />
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-black text-white">
      <header className="z-20 flex items-center justify-between px-4 py-3">
        <Button size="icon" variant="ghost" className="text-white" onClick={onBack} disabled={phase === "processing"}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div className="text-center">
          <p className="text-sm font-semibold">{roomName}</p>
          <p className="text-xs text-white/50">Room {progress} of {total}</p>
        </div>
        <div className="w-10" />
      </header>

      <div className="relative flex-1 overflow-hidden">
        <video ref={videoRef} autoPlay playsInline muted className="h-full w-full object-cover" />

        {phase === "setup" && (
          <div className="absolute inset-0 flex flex-col items-center justify-end bg-gradient-to-t from-black via-black/50 to-transparent px-6 pb-12">
            <div className="mb-6 flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-sky-500 to-emerald-500 shadow-lg shadow-sky-500/30">
              {videoMode ? <Video className="h-8 w-8" /> : <Sparkles className="h-8 w-8" />}
            </div>
            <h2 className="text-2xl font-bold tracking-tight">360° Room Capture</h2>
            <p className="mt-2 max-w-xs text-center text-sm text-white/75">
              {videoMode
                ? "One take. Press record, turn slowly in a full circle — that's it. Shaky hands are fine."
                : `Stand center. Rotate once. Capture ${SPHERE_CAPTURE.bucketCount} photos as you go.`}
            </p>
            <ul className="mt-6 w-full max-w-xs space-y-2 text-sm text-white/65">
              {videoMode ? (
                <>
                  <li>✓ No mount needed — handheld is fine</li>
                  <li>✓ We pick the sharpest frames automatically</li>
                  <li>✓ Preview full 360° before saving</li>
                </>
              ) : (
                <>
                  <li>✓ Tap capture as you rotate</li>
                  <li>✓ Live quality & blur detection</li>
                  <li>✓ Preview full 360° before saving</li>
                </>
              )}
            </ul>
            <Button className="mt-8 h-12 w-full max-w-xs text-base" size="lg" onClick={startCountdown}>
              {videoMode ? "Start recording" : "Begin capture"}
            </Button>
          </div>
        )}

        {phase === "countdown" && countdown > 0 && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/40 backdrop-blur-sm">
            <span className="text-8xl font-bold tabular-nums text-white animate-pulse">{countdown}</span>
          </div>
        )}

        {(phase === "capturing" || phase === "processing") && (
          <StreetViewOverlay
            buckets={buckets}
            currentYaw={currentYaw}
            targetYaw={null}
            progress={stats}
            hint={hint}
            phase={phase}
            isUpright={orientation.isUpright}
            rotationSpeed={rotationSpeed}
            qualityScore={quality.score}
            flash={flash}
            thumbnails={[]}
            recording={videoMode && phase === "capturing"}
            elapsedSec={elapsedSec}
          />
        )}
      </div>

      {phase === "capturing" && (
        <footer className="z-20 space-y-3 px-4 pb-8">
          {!manualMode && (
            <div className="h-2 overflow-hidden rounded-full bg-white/15">
              <div
                className="h-full rounded-full bg-gradient-to-r from-sky-500 to-emerald-400 transition-all duration-500"
                style={{ width: `${stats.pct}%` }}
              />
            </div>
          )}
          <div className="flex gap-2">
            {videoMode ? (
              <Button
                className="flex-1"
                size="lg"
                variant={canFinish ? "default" : "outline"}
                disabled={!canFinish}
                onClick={() => void finishRecording()}
              >
                {canFinish
                  ? `Finish recording (${elapsedSec}s)`
                  : manualMode
                    ? `Keep rotating… ${elapsedSec}s`
                    : `Keep rotating — ${stats.pct}% covered`}
              </Button>
            ) : (
              <>
                <Button className="flex-1" size="lg" onClick={() => void snapPhotoFallback()}>
                  Capture ({frames.length})
                </Button>
                {frames.length >= MIN_EXTRACTED_FRAMES && (
                  <Button className="flex-1" size="lg" variant="outline" onClick={() => void processPhotoFallback()}>
                    Preview 360°
                  </Button>
                )}
              </>
            )}
          </div>
        </footer>
      )}
    </div>
  );
}
