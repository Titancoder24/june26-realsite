/** Scene Intelligence Builder — cinematic flat-image scenes with motion + annotations */

export type MotionType =
  | "push_in"
  | "pull_out"
  | "truck_left"
  | "truck_right"
  | "pedestal_up"
  | "pedestal_down"
  | "slow_rotate"
  | "drone_up"
  | "cinematic_zoom"
  | "static_premium"
  | "depth_parallax";

export type AnnotationCategory =
  | "room_feature"
  | "material"
  | "amenity"
  | "pricing_note"
  | "legal_note"
  | "possession_note"
  | "view_detail"
  | "furniture_staging"
  | "upgrade_option"
  | "cta"
  | "internal_note";

export type DepthLayer = "foreground" | "midground" | "background";

export interface CropRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface SceneEditConfig {
  brightness?: number;
  contrast?: number;
  rotation?: number;
  saturation?: number;
  warmth?: number;
}

export interface MotionConfig {
  duration: number;
  easing: string;
  intensity?: number;
}

export interface PropertyScene {
  id: string;
  experience_id: string;
  property_id: string;
  title: string;
  description?: string;
  image_url: string;
  edited_image_url?: string;
  thumbnail_url?: string;
  scene_order: number;
  is_start_scene: boolean;
  motion_type: MotionType;
  motion_config: MotionConfig;
  duration: number;
  edit_config: SceneEditConfig;
  mobile_crop: CropRect;
  desktop_crop: CropRect;
  ai_context?: string;
  scene_annotations?: SceneAnnotationRecord[];
  created_at?: string;
}

export interface SceneAnnotationRecord {
  id: string;
  scene_id: string;
  property_id: string;
  experience_id: string;
  title: string;
  short_description?: string;
  description?: string;
  category: AnnotationCategory;
  x_position: number;
  y_position: number;
  depth_layer?: DepthLayer;
  visibility: "public" | "internal";
  cta_type?: string;
  cta_label?: string;
  media_url?: string;
  ai_context?: string;
  rag_enabled: boolean;
  rag_entry_id?: string;
  crm_tracking_enabled: boolean;
  sort_order?: number;
  created_at?: string;
}

export const MOTION_PRESETS: { type: MotionType; label: string; description: string }[] = [
  { type: "push_in", label: "Push In", description: "Slow zoom toward the focal point — ideal for wide rooms." },
  { type: "pull_out", label: "Pull Out", description: "Reveal the full space from a detail shot." },
  { type: "truck_left", label: "Truck Left", description: "Horizontal camera move left — great for kitchens and corridors." },
  { type: "truck_right", label: "Truck Right", description: "Horizontal camera move right — follows long features." },
  { type: "pedestal_up", label: "Pedestal Up", description: "Gentle upward reveal — works for exteriors and balconies." },
  { type: "pedestal_down", label: "Pedestal Down", description: "Descend into the space from above." },
  { type: "slow_rotate", label: "Slow Rotate Feel", description: "Subtle rotational drift for premium feel." },
  { type: "drone_up", label: "Drone Up Feel", description: "Upward exterior reveal — facades and towers." },
  { type: "cinematic_zoom", label: "Cinematic Zoom", description: "Dramatic slow zoom with slight pan." },
  { type: "static_premium", label: "Static Premium", description: "Minimal motion — hero shot with subtle breathe." },
  { type: "depth_parallax", label: "Depth Parallax", description: "Layered parallax effect (V1: simulated)." },
];

export const ANNOTATION_CATEGORIES: { value: AnnotationCategory; label: string }[] = [
  { value: "room_feature", label: "Room feature" },
  { value: "material", label: "Material" },
  { value: "amenity", label: "Amenity" },
  { value: "pricing_note", label: "Pricing note" },
  { value: "legal_note", label: "Legal note" },
  { value: "possession_note", label: "Possession note" },
  { value: "view_detail", label: "View detail" },
  { value: "furniture_staging", label: "Furniture / staging" },
  { value: "upgrade_option", label: "Upgrade option" },
  { value: "cta", label: "CTA" },
  { value: "internal_note", label: "Internal note" },
];

export function suggestMotionForScene(title: string): MotionType {
  const t = title.toLowerCase();
  if (t.includes("exterior") || t.includes("facade") || t.includes("tower")) return "drone_up";
  if (t.includes("kitchen") || t.includes("corridor") || t.includes("hall")) return "truck_right";
  if (t.includes("balcony") || t.includes("terrace") || t.includes("view")) return "pedestal_up";
  if (t.includes("bedroom") || t.includes("bath")) return "pull_out";
  if (t.includes("living") || t.includes("dining") || t.includes("lounge")) return "push_in";
  return "cinematic_zoom";
}
