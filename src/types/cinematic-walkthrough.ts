export type WalkthroughMotionType =
  | "push_in"
  | "pull_out"
  | "truck_left"
  | "truck_right"
  | "pedestal_up"
  | "pedestal_down"
  | "slow_rotate"
  | "cinematic_zoom"
  | "static_premium"
  | "depth_parallax";

export type EnhancementStatus = "pending" | "processing" | "completed" | "failed" | "skipped" | "approved" | "rejected";

export interface WalkthroughImage {
  id: string;
  experience_id: string;
  property_id: string;
  organization_id: string;
  project_id?: string | null;
  original_image_url: string;
  enhanced_image_url?: string | null;
  thumbnail_url?: string | null;
  mobile_crop_url?: string | null;
  desktop_crop_url?: string | null;
  file_name: string;
  file_size?: number | null;
  mime_type?: string | null;
  width?: number | null;
  height?: number | null;
  upload_status: string;
  enhancement_status: EnhancementStatus;
  enhancement_model?: string | null;
  enhancement_prompt?: string | null;
  enhancement_error?: string | null;
  approved_by_user: boolean;
  ai_analysis?: Record<string, unknown>;
  sort_order: number;
  included: boolean;
  created_at?: string;
}

export interface WalkthroughScene {
  id: string;
  experience_id: string;
  property_id: string;
  organization_id?: string | null;
  image_id?: string | null;
  title: string;
  description?: string | null;
  room_type?: string | null;
  caption?: string | null;
  image_url: string;
  edited_image_url?: string | null;
  thumbnail_url?: string | null;
  poster_url?: string | null;
  video_url?: string | null;
  video_url_720p?: string | null;
  video_url_1080p?: string | null;
  video_url_mobile?: string | null;
  veo_prompt?: string | null;
  scene_order: number;
  is_start_scene: boolean;
  motion_type: WalkthroughMotionType;
  motion_config?: Record<string, unknown>;
  duration: number;
  timeline_start?: number | null;
  timeline_end?: number | null;
  scene_status?: string | null;
  edit_config?: Record<string, unknown>;
  mobile_crop?: { x: number; y: number; width: number; height: number };
  desktop_crop?: { x: number; y: number; width: number; height: number };
  ai_context?: string | null;
  quality_notes?: string | null;
  warnings?: string[];
  walkthrough_annotations?: WalkthroughAnnotation[];
}

export interface WalkthroughAnnotation {
  id: string;
  scene_id: string;
  property_id: string;
  experience_id: string;
  title: string;
  short_description?: string | null;
  description?: string | null;
  category: string;
  x_position: number;
  y_position: number;
  visibility: string;
  pin_style?: string | null;
  icon_type?: string | null;
  cta_type?: string | null;
  cta_label?: string | null;
  media_url?: string | null;
  ai_context?: string | null;
  rag_enabled: boolean;
  rag_entry_id?: string | null;
  crm_tracking_enabled: boolean;
  sort_order: number;
  created_at?: string;
}

export interface WalkthroughChecklist {
  experience_id: string;
  images_uploaded: boolean;
  images_enhanced: boolean;
  scenes_created: boolean;
  scene_order_approved: boolean;
  motion_added: boolean;
  motion_videos_generated?: boolean;
  annotations_added: boolean;
  property_rag_added: boolean;
  ai_tested: boolean;
  viewer_previewed: boolean;
  ready_to_publish: boolean;
  warnings: string[];
}

export interface WalkthroughVideoJob {
  id: string;
  scene_id: string;
  experience_id: string;
  status: string;
  model: string;
  prompt: string;
  stored_video_url?: string | null;
  error?: string | null;
  created_at?: string;
}

export interface ScenePlanResult {
  image_id: string;
  room_type: string;
  title: string;
  description: string;
  caption: string;
  suggested_motion: WalkthroughMotionType;
  suggested_order: number;
  duration?: number;
  veo_prompt?: string;
  important_objects: string[];
  suggested_annotations: { title: string; x: number; y: number; category?: string }[];
  quality_notes: string;
  classification_confidence?: number;
  classification_reason?: string;
  needs_review?: boolean;
  include: boolean;
  warnings: string[];
}

export interface RagExtractedEntry {
  category: string;
  title: string;
  content: string;
}

export const WALKTHROUGH_MOTION_PRESETS: { type: WalkthroughMotionType; label: string; description: string }[] = [
  { type: "push_in", label: "Push In", description: "Slow zoom toward the scene" },
  { type: "pull_out", label: "Pull Out", description: "Reveal the full space" },
  { type: "truck_left", label: "Truck Left", description: "Pan left across the room" },
  { type: "truck_right", label: "Truck Right", description: "Pan right across the room" },
  { type: "pedestal_up", label: "Pedestal Up", description: "Gentle upward drift" },
  { type: "pedestal_down", label: "Pedestal Down", description: "Gentle downward drift" },
  { type: "cinematic_zoom", label: "Slow Zoom", description: "Cinematic multi-point zoom" },
  { type: "depth_parallax", label: "Soft Drift", description: "Subtle parallax drift" },
  { type: "static_premium", label: "Hero Reveal", description: "Minimal premium hold" },
  { type: "slow_rotate", label: "Static Premium", description: "Barely-there motion" },
];

export const WALKTHROUGH_WIZARD_STEPS = [
  { id: "upload", label: "Upload listing photos" },
  { id: "enhance", label: "Upscale & clean images" },
  { id: "scenes", label: "AI scene plan (Gemini)" },
  { id: "arrange", label: "Arrange room flow" },
  { id: "motion", label: "Veo video motion" },
  { id: "pins", label: "Add annotations" },
  { id: "rag", label: "Property knowledge" },
  { id: "preview", label: "Scroll preview" },
  { id: "publish", label: "Publish walkthrough" },
] as const;

export type WalkthroughWizardStep = (typeof WALKTHROUGH_WIZARD_STEPS)[number]["id"];
