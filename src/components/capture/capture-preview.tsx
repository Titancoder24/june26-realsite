"use client";

import { PanoramaViewer } from "@/components/buyer/panorama-viewer";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import type { CaptureQualityReport } from "@/lib/capture/capture-protocol";
import type { PanoramaConfig } from "@/lib/capture/pannellum-stitch";
import { Check, RotateCcw } from "lucide-react";

export function CapturePreview({
  previewUrl,
  panoramaConfig,
  quality,
  roomName,
  onAccept,
  onRetake,
  saving,
}: {
  previewUrl: string;
  panoramaConfig: PanoramaConfig;
  quality: CaptureQualityReport;
  roomName: string;
  onAccept: () => void;
  onRetake: () => void;
  saving?: boolean;
}) {
  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-black text-white">
      <div className="relative flex-1">
        <PanoramaViewer imageUrl={previewUrl} panoramaConfig={panoramaConfig} />
        <div className="pointer-events-none absolute inset-x-0 top-0 bg-gradient-to-b from-black/80 to-transparent p-4">
          <p className="text-xs uppercase tracking-widest text-white/60">Preview</p>
          <h2 className="text-lg font-semibold">{roomName}</h2>
          <div className="mt-2 flex flex-wrap gap-2">
            <Badge className="bg-green-600">{quality.label}</Badge>
            <Badge variant="secondary">{quality.score}/100 quality</Badge>
            <Badge variant="secondary">{quality.coveragePct}% coverage</Badge>
          </div>
        </div>
      </div>

      <div className="space-y-3 border-t border-white/10 bg-black/90 p-4 pb-8 backdrop-blur">
        {quality.issues.length > 0 && (
          <p className="text-center text-xs text-amber-300">{quality.issues.join(" · ")}</p>
        )}
        <p className="text-center text-sm text-white/70">Swipe to look around — this is what buyers will see</p>
        <div className="flex gap-3">
          <Button variant="outline" className="flex-1 border-white/30 text-white" onClick={onRetake} disabled={saving}>
            <RotateCcw className="mr-2 h-4 w-4" /> Retake
          </Button>
          <Button className="flex-1" onClick={onAccept} disabled={saving}>
            <Check className="mr-2 h-4 w-4" /> {saving ? "Saving…" : "Accept & continue"}
          </Button>
        </div>
      </div>
    </div>
  );
}
