"use client";

import { SPHERE_CAPTURE } from "@/lib/capture/capture-protocol";
import type { CoverageBucket } from "@/lib/capture/capture-protocol";
import { cn } from "@/lib/utils";

export function StreetViewOverlay({
  buckets,
  currentYaw,
  targetYaw,
  progress,
  hint,
  phase,
  isUpright,
  rotationSpeed,
  qualityScore,
  flash,
  thumbnails,
  recording = false,
  elapsedSec = 0,
}: {
  buckets: CoverageBucket[];
  currentYaw: number | null;
  targetYaw: number | null;
  progress: { done: number; total: number; pct: number };
  hint: string;
  phase: string;
  isUpright: boolean;
  rotationSpeed: number;
  qualityScore: number;
  flash?: boolean;
  thumbnails: string[];
  recording?: boolean;
  elapsedSec?: number;
}) {
  const size = 300;
  const cx = size / 2;
  const cy = size / 2;
  const r = 120;

  const speedOk = rotationSpeed <= SPHERE_CAPTURE.maxRotationSpeed;

  return (
    <div className="pointer-events-none absolute inset-0 flex flex-col">
      {flash && <div className="absolute inset-0 z-30 bg-white/50 transition-opacity duration-100" />}

      {/* Vignette */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,transparent_40%,rgba(0,0,0,0.55)_100%)]" />

      {/* Top status bar */}
      <div className="z-10 flex items-center justify-between px-4 pt-2">
        {recording ? (
          <div className="flex items-center gap-1.5 rounded-full bg-black/50 px-3 py-1 text-xs backdrop-blur-md">
            <span className="relative flex h-2.5 w-2.5">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-red-500 opacity-75" />
              <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-red-500" />
            </span>
            <span className="font-semibold text-red-400">REC</span>
            <span className="tabular-nums text-white/70">
              {Math.floor(elapsedSec / 60)}:{String(elapsedSec % 60).padStart(2, "0")}
            </span>
          </div>
        ) : (
          <div className="rounded-full bg-black/50 px-3 py-1 text-xs backdrop-blur-md">
            <span className="font-semibold text-green-400">{progress.pct}%</span>
            <span className="text-white/50"> covered</span>
          </div>
        )}
        <div className="rounded-full bg-black/50 px-3 py-1 text-xs backdrop-blur-md">
          {recording ? (
            <>
              <span className="font-semibold text-green-400">{progress.pct}%</span>
              <span className="text-white/50"> swept</span>
            </>
          ) : (
            <>
              Quality <span className="font-semibold text-sky-400">{qualityScore}</span>
            </>
          )}
        </div>
        <div className={cn("rounded-full px-3 py-1 text-xs backdrop-blur-md", speedOk ? "bg-black/50 text-white/70" : "bg-amber-500/80 text-white")}>
          {speedOk ? "Good speed" : "Slow down"}
        </div>
      </div>

      {/* Compass */}
      <div className="flex flex-1 items-center justify-center">
        <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="drop-shadow-2xl">
          <defs>
            <linearGradient id="ringGrad" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#38bdf8" stopOpacity="0.6" />
              <stop offset="100%" stopColor="#4ade80" stopOpacity="0.6" />
            </linearGradient>
          </defs>

          {/* Filled coverage pie slices */}
          {buckets.map((b) => {
            const start = ((b.centerYaw - SPHERE_CAPTURE.bucketStep / 2 - 90) * Math.PI) / 180;
            const end = ((b.centerYaw + SPHERE_CAPTURE.bucketStep / 2 - 90) * Math.PI) / 180;
            const x1 = cx + r * Math.cos(start);
            const y1 = cy + r * Math.sin(start);
            const x2 = cx + r * Math.cos(end);
            const y2 = cy + r * Math.sin(end);
            const large = end - start > Math.PI ? 1 : 0;
            if (!b.covered) return null;
            return (
              <path
                key={`fill-${b.index}`}
                d={`M ${cx} ${cy} L ${x1} ${y1} A ${r} ${r} 0 ${large} 1 ${x2} ${y2} Z`}
                fill="rgba(74,222,128,0.35)"
                stroke="none"
              />
            );
          })}

          {/* Bucket ticks */}
          {buckets.map((b) => {
            const angle = ((b.centerYaw - 90) * Math.PI) / 180;
            const inner = r - 6;
            const outer = b.covered ? r + 8 : r + 2;
            return (
              <line
                key={b.index}
                x1={cx + inner * Math.cos(angle)}
                y1={cy + inner * Math.sin(angle)}
                x2={cx + outer * Math.cos(angle)}
                y2={cy + outer * Math.sin(angle)}
                stroke={b.covered ? "#4ade80" : targetYaw != null && b.centerYaw === targetYaw ? "#38bdf8" : "rgba(255,255,255,0.25)"}
                strokeWidth={b.covered ? 3.5 : 1.5}
                strokeLinecap="round"
              />
            );
          })}

          {/* Progress ring */}
          <circle
            cx={cx}
            cy={cy}
            r={r + 14}
            fill="none"
            stroke="url(#ringGrad)"
            strokeWidth="4"
            strokeDasharray={`${(progress.pct / 100) * 2 * Math.PI * (r + 14)} ${2 * Math.PI * (r + 14)}`}
            strokeLinecap="round"
            transform={`rotate(-90 ${cx} ${cy})`}
            opacity="0.9"
          />

          {/* Target */}
          {targetYaw != null && phase === "capturing" && (
            <>
              <circle
                cx={cx + (r + 4) * Math.cos(((targetYaw - 90) * Math.PI) / 180)}
                cy={cy + (r + 4) * Math.sin(((targetYaw - 90) * Math.PI) / 180)}
                r="14"
                fill="none"
                stroke="#38bdf8"
                strokeWidth="2"
                opacity="0.6"
                className="animate-ping"
              />
              <circle
                cx={cx + (r + 4) * Math.cos(((targetYaw - 90) * Math.PI) / 180)}
                cy={cy + (r + 4) * Math.sin(((targetYaw - 90) * Math.PI) / 180)}
                r="8"
                fill="#38bdf8"
                stroke="white"
                strokeWidth="2"
              />
            </>
          )}

          {/* You are here */}
          {currentYaw != null && phase === "capturing" && (
            <g transform={`rotate(${currentYaw} ${cx} ${cy})`}>
              <polygon
                points={`${cx},${cy - r + 36} ${cx - 8},${cy - r + 56} ${cx + 8},${cy - r + 56}`}
                fill="#fbbf24"
                stroke="white"
                strokeWidth="1.5"
              />
            </g>
          )}

          {/* Level bubble */}
          <circle cx={cx} cy={cy} r="32" fill="rgba(0,0,0,0.35)" stroke="rgba(255,255,255,0.2)" strokeWidth="1" />
          <circle cx={cx} cy={cy} r="4" fill={isUpright ? "#4ade80" : "#fbbf24"} />
        </svg>
      </div>

      {/* Thumbnail filmstrip */}
      {thumbnails.length > 0 && (
        <div className="absolute left-0 right-0 top-16 flex justify-center gap-1 px-4">
          <div className="flex max-w-full gap-1 overflow-x-auto rounded-lg bg-black/40 p-1.5 backdrop-blur-md">
            {thumbnails.slice(-8).map((url, i) => (
              // eslint-disable-next-line @next/next/no-img-element
              <img key={url + i} src={url} alt="" className="h-10 w-10 shrink-0 rounded object-cover ring-1 ring-white/30" />
            ))}
          </div>
        </div>
      )}

      {/* Coaching */}
      <div className="z-10 px-6 pb-32 text-center">
        <div className="mx-auto mb-3 max-w-sm rounded-2xl bg-black/55 px-5 py-3 backdrop-blur-md">
          <p className="text-base font-medium leading-snug text-white">{hint}</p>
        </div>
        <p className="text-xs text-white/50">
          {recording
            ? "one continuous turn · shaky is fine · we pick the sharpest frames"
            : `${progress.done}/${progress.total} · rotate any direction`}
        </p>
      </div>
    </div>
  );
}
