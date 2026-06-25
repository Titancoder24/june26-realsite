"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { SplatViewer } from "@/components/buyer/splat-viewer";
import { Map, MapPin, X } from "lucide-react";
import type { Checkpoint } from "@/components/buyer/checkpoint-overlay";

interface FloorMapPin {
  id: string;
  name: string;
  x: number;
  y: number;
  sceneId?: string;
}

export function ImmersiveSplatShell({
  experienceId,
  splat,
  checkpoints = [],
  floorMap,
  projectName,
  propertyName,
  brandColor,
  logoUrl,
  onPositionChange,
  onCheckpointClick,
  onFloorMapPinClick,
}: {
  experienceId?: string;
  splat?: {
    spz_100k_url?: string;
    spz_500k_url?: string;
    spz_full_res_url?: string;
    world_marble_url?: string;
    collider_mesh_url?: string;
    viewer_url?: string;
    splat_format?: string;
    provider?: string;
  };
  checkpoints?: Checkpoint[];
  floorMap?: { image_url: string; pins: FloorMapPin[] };
  projectName?: string;
  propertyName?: string;
  brandColor?: string;
  logoUrl?: string;
  onPositionChange?: (x: number, y: number, z: number) => void;
  onCheckpointClick?: (id: string) => void;
  onFloorMapPinClick?: (pinId: string) => void;
}) {
  const [showPins, setShowPins] = useState(true);
  const [showFloorMap, setShowFloorMap] = useState(false);

  const hasSplat = Boolean(splat?.spz_full_res_url || splat?.spz_500k_url || splat?.world_marble_url || splat?.viewer_url);

  return (
    <div className="relative h-full w-full bg-black text-white">
      <div className="absolute inset-0">
        {hasSplat ? (
          <SplatViewer
            experienceId={experienceId}
            spz100kUrl={splat?.spz_100k_url}
            spz500kUrl={splat?.spz_500k_url}
            spzFullResUrl={splat?.spz_full_res_url}
            worldMarbleUrl={splat?.world_marble_url}
            colliderMeshUrl={splat?.collider_mesh_url}
            splatFormat={(splat as { splat_format?: string })?.splat_format ?? (splat?.provider === "spaitial" ? "spz" : undefined)}
            onPositionChange={onPositionChange}
          />
        ) : (
          <div className="flex h-full items-center justify-center text-white/60">3D world assets not ready yet.</div>
        )}
      </div>

      {/* Header */}
      <div className="pointer-events-none absolute left-0 right-0 top-0 bg-gradient-to-b from-black/70 to-transparent p-4">
        <div className="pointer-events-auto flex items-center gap-3">
          {logoUrl && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={logoUrl} alt="" className="h-8 w-8 rounded object-cover" />
          )}
          <div>
            <p className="text-xs text-white/70">{projectName}</p>
            <p className="font-semibold" style={brandColor ? { color: brandColor } : undefined}>{propertyName}</p>
          </div>
        </div>
      </div>

      {/* Pin panel */}
      {showPins && checkpoints.length > 0 && (
        <div className="absolute bottom-20 right-3 z-20 w-56 rounded-xl border border-white/10 bg-black/75 backdrop-blur-md sm:right-4 sm:w-64">
          <div className="flex items-center justify-between border-b border-white/10 px-3 py-2">
            <span className="text-xs font-semibold uppercase tracking-wide text-white/70">Annotations</span>
            <Button size="icon" variant="ghost" className="h-7 w-7 text-white" onClick={() => setShowPins(false)}>
              <X className="h-4 w-4" />
            </Button>
          </div>
          <ScrollArea className="max-h-48">
            <div className="space-y-1 p-2">
              {checkpoints.map((cp) => (
                <button
                  key={cp.id}
                  type="button"
                  onClick={() => onCheckpointClick?.(cp.id)}
                  className="flex w-full items-start gap-2 rounded-lg px-2 py-2 text-left text-sm transition-colors hover:bg-white/10"
                >
                  <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                  <span>
                    <span className="block font-medium">{cp.title}</span>
                    {cp.checkpoint_type && (
                      <Badge variant="secondary" className="mt-1 text-[10px]">{cp.checkpoint_type.replace(/_/g, " ")}</Badge>
                    )}
                  </span>
                </button>
              ))}
            </div>
          </ScrollArea>
        </div>
      )}

      {!showPins && checkpoints.length > 0 && (
        <Button
          size="sm"
          variant="secondary"
          className="absolute bottom-20 right-3 z-20"
          onClick={() => setShowPins(true)}
        >
          <MapPin className="mr-1 h-4 w-4" />
          Pins ({checkpoints.length})
        </Button>
      )}

      {/* Floor map */}
      {floorMap && (
        <>
          <Button
            size="icon"
            variant="secondary"
            className="absolute right-3 top-16 z-20 h-10 w-10 rounded-full"
            onClick={() => setShowFloorMap((v) => !v)}
          >
            <Map className="h-5 w-5" />
          </Button>
          {showFloorMap && (
            <div className="absolute left-3 right-3 top-28 z-20 mx-auto max-w-md rounded-xl border border-white/10 bg-black/80 p-3 backdrop-blur-md">
              <div className="mb-2 flex items-center justify-between">
                <p className="text-sm font-semibold">Floor Map</p>
                <Button size="icon" variant="ghost" className="h-7 w-7 text-white" onClick={() => setShowFloorMap(false)}>
                  <X className="h-4 w-4" />
                </Button>
              </div>
              <div className="relative">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={floorMap.image_url} alt="Floor map" className="w-full rounded-lg" />
                {floorMap.pins?.map((pin) => (
                  <button
                    key={pin.id}
                    type="button"
                    className="absolute h-3 w-3 -translate-x-1/2 -translate-y-1/2 rounded-full bg-primary ring-2 ring-white"
                    style={{ left: `${pin.x}%`, top: `${pin.y}%` }}
                    title={pin.name}
                    onClick={() => onFloorMapPinClick?.(pin.id)}
                  />
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
