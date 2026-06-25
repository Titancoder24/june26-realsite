"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { getMotionKeyframes, interpolateMotion } from "@/lib/motion/motion-keyframes";
import type { CropRect, MotionType, PropertyScene, SceneAnnotationRecord, SceneEditConfig } from "@/types/scene-intelligence";
import { MapPin } from "lucide-react";

export type VideoFitMode = "contain" | "cover";

function editStyle(edit: SceneEditConfig = {}) {
  const filters = [
    edit.brightness != null ? `brightness(${edit.brightness}%)` : null,
    edit.contrast != null ? `contrast(${edit.contrast}%)` : null,
  ].filter(Boolean).join(" ");
  return {
    filter: filters || undefined,
    transform: edit.rotation ? `rotate(${edit.rotation}deg)` : undefined,
  };
}

function computeMediaRect(
  containerW: number,
  containerH: number,
  mediaW: number,
  mediaH: number,
  fit: VideoFitMode,
) {
  if (!containerW || !containerH || !mediaW || !mediaH) {
    return { left: 0, top: 0, width: containerW, height: containerH };
  }
  if (fit === "cover") {
    return { left: 0, top: 0, width: containerW, height: containerH };
  }
  const scale = Math.min(containerW / mediaW, containerH / mediaH);
  const width = mediaW * scale;
  const height = mediaH * scale;
  return {
    left: (containerW - width) / 2,
    top: (containerH - height) / 2,
    width,
    height,
  };
}

export function MotionSceneViewer({
  scene,
  annotations = [],
  isMobile = false,
  playing = true,
  videoUrl,
  posterUrl,
  highlightedAnnotationId,
  scrubProgress,
  scrollControlled = false,
  videoFit = "contain",
  showCaption = true,
  showAnnotations = true,
  storiesMode = false,
  onProgress,
  onAnnotationClick,
  onVideoEnded,
}: {
  scene: PropertyScene;
  annotations?: SceneAnnotationRecord[];
  isMobile?: boolean;
  playing?: boolean;
  videoUrl?: string | null;
  posterUrl?: string | null;
  highlightedAnnotationId?: string | null;
  scrubProgress?: number;
  scrollControlled?: boolean;
  videoFit?: VideoFitMode;
  showCaption?: boolean;
  showAnnotations?: boolean;
  storiesMode?: boolean;
  onProgress?: (progress: number) => void;
  onAnnotationClick?: (ann: SceneAnnotationRecord) => void;
  onVideoEnded?: () => void;
}) {
  const [autoProgress, setAutoProgress] = useState(0);
  const [mediaRect, setMediaRect] = useState({ left: 0, top: 0, width: 0, height: 0 });
  const startRef = useRef<number | null>(null);
  const rafRef = useRef<number>(0);
  const videoRef = useRef<HTMLVideoElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const duration = (scene.motion_config?.duration ?? scene.duration ?? 8) * 1000;
  const motionType = (scene.motion_type ?? "push_in") as MotionType;
  const keyframes = getMotionKeyframes(motionType, scene.motion_config?.intensity ?? 1);
  const progress = scrubProgress ?? autoProgress;
  const frame = interpolateMotion(keyframes, progress);
  const crop = (isMobile ? scene.mobile_crop : scene.desktop_crop) as CropRect ?? { x: 0, y: 0, width: 1, height: 1 };
  const imageUrl = scene.edited_image_url || scene.image_url;
  const playbackUrl = videoUrl ?? null;
  const isScrubMode = scrollControlled && scrubProgress != null;
  const objectFitClass = videoFit === "cover" ? "object-cover" : "object-contain";

  const updateMediaRect = useCallback(() => {
    const container = containerRef.current;
    const video = videoRef.current;
    if (!container) return;
    const mediaW = video?.videoWidth || 16;
    const mediaH = video?.videoHeight || 9;
    setMediaRect(computeMediaRect(
      container.clientWidth,
      container.clientHeight,
      mediaW,
      mediaH,
      videoFit,
    ));
  }, [videoFit]);

  useEffect(() => {
    onProgress?.(progress);
  }, [progress, onProgress]);

  useEffect(() => {
    if (playbackUrl || isScrubMode || !playing) return;
    startRef.current = performance.now();
    const tick = (now: number) => {
      if (!startRef.current) return;
      const p = ((now - startRef.current) % duration) / duration;
      setAutoProgress(p);
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafRef.current);
  }, [playing, duration, scene.id, playbackUrl, isScrubMode]);

  useEffect(() => {
    const video = videoRef.current;
    if (!video || !playbackUrl) return;

    const onEnded = () => {
      if (storiesMode && !isScrubMode && playing) onVideoEnded?.();
    };
    video.addEventListener("ended", onEnded);

    const applyScrub = () => {
      if (!video.duration || !Number.isFinite(video.duration)) return;
      const target = Math.min(video.duration - 0.05, Math.max(0, progress * video.duration));
      if (Math.abs(video.currentTime - target) > 0.04) {
        video.currentTime = target;
      }
    };

    if (isScrubMode) {
      video.pause();
      if (video.readyState >= 1) applyScrub();
      else video.addEventListener("loadedmetadata", applyScrub, { once: true });
      return () => {
        video.removeEventListener("loadedmetadata", applyScrub);
        video.removeEventListener("ended", onEnded);
      };
    }

    if (playing) {
      video.muted = true;
      void video.play().catch(() => {});
    } else {
      video.pause();
    }

    return () => video.removeEventListener("ended", onEnded);
  }, [progress, playbackUrl, isScrubMode, playing, storiesMode, onVideoEnded]);

  useEffect(() => {
    updateMediaRect();
    const container = containerRef.current;
    if (!container) return;
    const ro = new ResizeObserver(() => updateMediaRect());
    ro.observe(container);
    return () => ro.disconnect();
  }, [updateMediaRect, playbackUrl, videoFit]);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    const onMeta = () => updateMediaRect();
    video.addEventListener("loadedmetadata", onMeta);
    return () => video.removeEventListener("loadedmetadata", onMeta);
  }, [updateMediaRect, playbackUrl]);

  const imgTransform = `scale(${frame.scale}) translate(${frame.translateX}%, ${frame.translateY}%) rotate(${frame.rotate}deg)`;
  const pinBox = videoFit === "contain" && mediaRect.width > 0 ? mediaRect : null;

  return (
    <div ref={containerRef} className="relative h-full w-full overflow-hidden bg-black">
      {playbackUrl ? (
        <video
          ref={videoRef}
          src={playbackUrl}
          poster={posterUrl ?? imageUrl}
          className={`absolute inset-0 h-full w-full ${objectFitClass}`}
          autoPlay={false}
          muted
          loop={!isScrubMode && !storiesMode}
          playsInline
          preload="auto"
        />
      ) : (
        <div className="absolute inset-0 flex items-center justify-center">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={imageUrl}
            alt={scene.title}
            className={`max-h-full max-w-full ${objectFitClass} transition-none will-change-transform`}
            style={{
              ...editStyle(scene.edit_config),
              transform: imgTransform,
              objectPosition: `${(crop.x + crop.width / 2) * 100}% ${(crop.y + crop.height / 2) * 100}%`,
            }}
            draggable={false}
          />
        </div>
      )}

      {showAnnotations && (
      <div
        className="pointer-events-none absolute z-20"
        style={pinBox ? {
          left: pinBox.left,
          top: pinBox.top,
          width: pinBox.width,
          height: pinBox.height,
        } : { inset: 0 }}
      >
        {annotations.filter((a) => a.visibility === "public").map((ann) => {
          const left = `${ann.x_position * 100}%`;
          const top = `${ann.y_position * 100}%`;
          return (
            <button
              key={ann.id}
              type="button"
              className={`pointer-events-auto absolute -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white bg-primary/90 shadow-lg hover:scale-110 ${highlightedAnnotationId === ann.id ? "scale-125 animate-pulse ring-4 ring-yellow-300" : ""} ${isMobile ? "wt-pin-mobile p-2" : "p-1.5"}`}
              style={{ left, top }}
              onClick={() => onAnnotationClick?.(ann)}
              aria-label={ann.title}
            >
              <MapPin className={`text-white ${isMobile ? "h-5 w-5" : "h-4 w-4"}`} />
            </button>
          );
        })}
      </div>
      )}

      {showCaption && (
        <div className="absolute bottom-0 left-0 right-0 z-10 bg-gradient-to-t from-black/70 to-transparent p-4 pb-24 sm:pb-20">
          <p className="text-base font-semibold text-white sm:text-lg">{scene.title}</p>
          {scene.description && <p className="text-sm text-white/70">{scene.description}</p>}
        </div>
      )}
    </div>
  );
}
