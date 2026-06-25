import type { WalkthroughScene } from "@/types/cinematic-walkthrough";

export const ROOM_TYPE_LABELS: Record<string, string> = {
  exterior: "Exterior",
  entrance: "Entrance",
  living_room: "Living Room",
  dining: "Dining Area",
  dining_area: "Dining Area",
  kitchen: "Kitchen",
  master_bedroom: "Master Bedroom",
  bedroom: "Bedroom",
  bedroom_2: "Bedroom 2",
  bedroom_3: "Bedroom 3",
  bathroom: "Bathroom",
  balcony: "Balcony",
  staircase: "Staircase",
  parking: "Parking",
  amenities: "Amenities",
  utility: "Utility",
  study: "Study",
  terrace: "Terrace",
  garden: "Garden",
  pool: "Pool",
  room: "Room",
  unknown: "Unknown",
};

export interface SceneClassificationMeta {
  classification_confidence?: number;
  classification_reason?: string;
  needs_review?: boolean;
  included?: boolean;
}

export function roomTypeLabel(roomType?: string | null): string {
  if (!roomType) return "Room";
  return ROOM_TYPE_LABELS[roomType] ?? roomType.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

export function looksLikeScreenshotName(value: string): boolean {
  return /screenshot|screen[\s_-]?shot|img[_-]?\d|photo[_-]?\d|snap[\s_-]?\d|capture|\.png|\.jpg|\.jpeg|\.webp|at\s+\d{1,2}[.:]\d{2}/i.test(value);
}

export function getSceneClassification(scene: WalkthroughScene): SceneClassificationMeta {
  const cfg = (scene.edit_config ?? {}) as SceneClassificationMeta;
  const confidence = typeof cfg.classification_confidence === "number" ? cfg.classification_confidence : undefined;
  const needsReview = cfg.needs_review === true
    || looksLikeScreenshotName(scene.title)
    || (confidence != null && confidence < 0.65);
  return {
    classification_confidence: confidence,
    classification_reason: cfg.classification_reason,
    needs_review: needsReview,
    included: scene.scene_status !== "excluded" && cfg.included !== false,
  };
}

export function isSceneIncluded(scene: WalkthroughScene): boolean {
  return getSceneClassification(scene).included !== false;
}

export function formatConfidence(confidence?: number): string {
  if (confidence == null || Number.isNaN(confidence)) return "Needs Review";
  const pct = Math.round(confidence * 100);
  if (pct < 65) return "Needs Review";
  return `${pct}% confident`;
}
