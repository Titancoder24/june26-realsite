/** Spatial annotation model — Matterport-class pins on 360° scenes. */

export type PinCategory =
  | "navigation"
  | "architecture"
  | "fixtures"
  | "appliances"
  | "furniture"
  | "views"
  | "amenities"
  | "real_estate"
  | "media"
  | "tools"
  | "safety"
  | "custom";

export type PinAction = "navigate" | "info" | "media" | "cta" | "measure" | "link";

export type PinTypeId = string;

export interface PinDefinition {
  id: PinTypeId;
  category: PinCategory;
  label: string;
  icon: string;
  color: string;
  action: PinAction;
  description?: string;
  /** Suggested default label when placing this pin */
  defaultLabel?: string;
  requiresTargetScene?: boolean;
}

export interface AnnotationPayload {
  description?: string;
  mediaUrl?: string;
  mediaType?: "image" | "video" | "document";
  linkUrl?: string;
  ctaLabel?: string;
  ctaType?: "book_visit" | "callback" | "whatsapp" | "call";
  value?: string;
  unit?: string;
  aiContext?: string;
}

export interface SceneAnnotation {
  id: string;
  type: PinTypeId;
  label: string;
  yaw: number;
  pitch: number;
  targetSceneId?: string;
  payload?: AnnotationPayload;
  visibility?: "public" | "internal";
  sortOrder?: number;
  createdAt?: string;
}

/** Legacy hotspot shape — normalized on read */
export interface LegacyHotspot {
  id: string;
  label: string;
  yaw: number;
  pitch: number;
  targetSceneId?: string;
  type?: PinTypeId;
  payload?: AnnotationPayload;
}

export function normalizeAnnotation(raw: LegacyHotspot | SceneAnnotation): SceneAnnotation {
  const type = raw.type ?? (raw.targetSceneId ? "doorway" : "info");
  return {
    id: raw.id,
    type,
    label: raw.label,
    yaw: raw.yaw,
    pitch: raw.pitch,
    targetSceneId: raw.targetSceneId,
    payload: raw.payload,
    visibility: "visibility" in raw ? (raw as SceneAnnotation).visibility : "public",
    sortOrder: "sortOrder" in raw ? (raw as SceneAnnotation).sortOrder : undefined,
    createdAt: "createdAt" in raw ? (raw as SceneAnnotation).createdAt : undefined,
  };
}

export function normalizeAnnotations(raw: LegacyHotspot[]): SceneAnnotation[] {
  return raw.map(normalizeAnnotation);
}
