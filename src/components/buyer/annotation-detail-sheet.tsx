"use client";

import { getPin } from "@/lib/pins/pin-library";
import type { SceneAnnotation } from "@/types/annotations";
import { Button } from "@/components/ui/button";
import { X } from "lucide-react";

export function AnnotationDetailSheet({
  annotation,
  onClose,
  onNavigate,
  onCta,
}: {
  annotation: SceneAnnotation | null;
  onClose: () => void;
  onNavigate?: (sceneId: string) => void;
  onCta?: (type: string) => void;
}) {
  if (!annotation) return null;
  const pin = getPin(annotation.type);

  return (
    <div
      className="fixed inset-x-0 bottom-0 z-50 rounded-t-2xl border-t bg-white shadow-2xl md:inset-x-auto md:right-4 md:bottom-4 md:max-w-sm md:rounded-2xl md:border"
      style={{ paddingBottom: "max(1rem, env(safe-area-inset-bottom))" }}
    >
      <div className="flex items-start gap-3 p-4">
        <span className="text-3xl">{pin.icon}</span>
        <div className="min-w-0 flex-1">
          <p className="font-semibold">{annotation.label}</p>
          <p className="text-xs text-muted-foreground">{pin.label}</p>
        </div>
        <button type="button" onClick={onClose} className="rounded-full p-1 hover:bg-muted" aria-label="Close">
          <X className="h-5 w-5" />
        </button>
      </div>
      {annotation.payload?.description && (
        <p className="px-4 pb-3 text-sm text-muted-foreground">{annotation.payload.description}</p>
      )}
      {annotation.payload?.mediaUrl && (
        <div className="px-4 pb-3">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={annotation.payload.mediaUrl} alt={annotation.label} className="max-h-40 w-full rounded-lg object-cover" />
        </div>
      )}
      <div className="flex gap-2 px-4 pb-4">
        {annotation.targetSceneId && onNavigate && (
          <Button className="flex-1" onClick={() => onNavigate(annotation.targetSceneId!)}>
            Go to linked room
          </Button>
        )}
        {pin.action === "cta" && onCta && (
          <Button className="flex-1" onClick={() => onCta(annotation.payload?.ctaType ?? "book_visit")}>
            {annotation.payload?.ctaLabel ?? pin.label}
          </Button>
        )}
      </div>
    </div>
  );
}
