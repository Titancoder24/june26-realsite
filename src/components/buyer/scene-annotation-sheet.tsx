"use client";

import { Button } from "@/components/ui/button";
import type { SceneAnnotationRecord } from "@/types/scene-intelligence";
import { X } from "lucide-react";

export function SceneAnnotationSheet({
  annotation,
  onClose,
  onCta,
}: {
  annotation: SceneAnnotationRecord | null;
  onClose: () => void;
  onCta?: (type: string) => void;
}) {
  if (!annotation) return null;

  return (
    <div
      className="fixed inset-x-0 bottom-0 z-50 rounded-t-2xl border-t bg-white shadow-2xl md:inset-x-auto md:right-4 md:bottom-4 md:max-w-sm md:rounded-2xl md:border"
      style={{ paddingBottom: "max(1rem, env(safe-area-inset-bottom))" }}
    >
      <div className="flex items-start gap-3 p-4">
        <div className="min-w-0 flex-1">
          <p className="font-semibold">{annotation.title}</p>
          <p className="text-xs capitalize text-muted-foreground">{annotation.category.replace(/_/g, " ")}</p>
        </div>
        <button type="button" onClick={onClose} className="rounded-full p-1 hover:bg-muted" aria-label="Close">
          <X className="h-5 w-5" />
        </button>
      </div>
      {(annotation.short_description || annotation.description) && (
        <p className="px-4 pb-3 text-sm text-muted-foreground">
          {annotation.short_description || annotation.description}
        </p>
      )}
      {annotation.media_url && (
        <div className="px-4 pb-3">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={annotation.media_url} alt={annotation.title} className="max-h-40 w-full rounded-lg object-cover" />
        </div>
      )}
      {annotation.cta_type && onCta && (
        <div className="px-4 pb-4">
          <Button className="w-full" onClick={() => onCta(annotation.cta_type!)}>
            {annotation.cta_label ?? "Learn more"}
          </Button>
        </div>
      )}
    </div>
  );
}
