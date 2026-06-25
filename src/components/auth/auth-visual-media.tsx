"use client";

import Image from "next/image";
import { useCallback, useRef, useState } from "react";
import { AUTH_VISUAL_IMAGE, AUTH_VISUAL_VIDEO } from "@/lib/marketing-images";

export function AuthVisualMedia({ className }: { className?: string }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [useFallback, setUseFallback] = useState(false);

  const handleVideoError = useCallback(() => {
    setUseFallback(true);
  }, []);

  const ensurePlayback = useCallback(() => {
    const video = videoRef.current;
    if (!video) return;
    video.muted = true;
    void video.play().catch(() => {
      // Keep video visible with poster — only swap on load error
    });
  }, []);

  return (
    <div
      className={`auth-visual-media relative h-full min-h-full w-full overflow-hidden bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 ${className ?? ""}`}
    >
      {!useFallback ? (
        <video
          ref={videoRef}
          src={AUTH_VISUAL_VIDEO}
          poster={AUTH_VISUAL_IMAGE}
          autoPlay
          loop
          muted
          playsInline
          preload="auto"
          disablePictureInPicture
          controls={false}
          aria-hidden="true"
          onError={handleVideoError}
          onLoadedData={ensurePlayback}
          onCanPlay={ensurePlayback}
          className="block h-full min-h-full w-full object-cover object-center"
        />
      ) : (
        <Image
          src={AUTH_VISUAL_IMAGE}
          alt="Premium luxury apartment interior at golden hour"
          fill
          priority
          sizes="(min-width: 1024px) 52vw, 100vw"
          className="object-cover object-center"
        />
      )}
    </div>
  );
}
