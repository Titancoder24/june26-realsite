"use client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

export type Checkpoint = {
  id: string;
  title: string;
  description?: string;
  checkpoint_type?: string;
  scene_id?: string;
  cta_label?: string;
  cta_type?: string;
};

export function CheckpointOverlay({
  checkpoint,
  onClose,
  onCta,
}: {
  checkpoint: Checkpoint | null;
  onClose: () => void;
  onCta?: (checkpoint: Checkpoint) => void;
}) {
  if (!checkpoint) return null;

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <DialogTitle>{checkpoint.title}</DialogTitle>
            {checkpoint.checkpoint_type && (
              <Badge variant="secondary">{checkpoint.checkpoint_type.replace(/_/g, " ")}</Badge>
            )}
          </div>
          {checkpoint.description && (
            <DialogDescription>{checkpoint.description}</DialogDescription>
          )}
        </DialogHeader>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Close</Button>
          {checkpoint.cta_label && (
            <Button onClick={() => onCta?.(checkpoint)}>{checkpoint.cta_label}</Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
