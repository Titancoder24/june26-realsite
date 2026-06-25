export const IMAGE_WALKTHROUGH_ROOM_TYPES = [
  "exterior",
  "entrance",
  "foyer",
  "living_room",
  "dining_area",
  "kitchen",
  "bedroom",
  "master_bedroom",
  "bathroom",
  "balcony",
  "staircase",
  "corridor",
  "parking",
  "amenity",
  "utility",
  "unknown",
] as const;

export type ImageWalkthroughRoomType = (typeof IMAGE_WALKTHROUGH_ROOM_TYPES)[number];

export const IMAGE_WALKTHROUGH_ZONES = [
  "exterior",
  "entry",
  "common_area",
  "private_area",
  "service_area",
  "amenity",
] as const;

export type ImageWalkthroughZone = (typeof IMAGE_WALKTHROUGH_ZONES)[number];

export type ImageWalkthroughMediaType = "flat" | "equirectangular";

export type ImageWalkthroughEnhancementStatus =
  | "pending"
  | "processing"
  | "completed"
  | "failed"
  | "skipped";

export type ImageWalkthroughWizardStep =
  | "upload"
  | "enhance"
  | "analyze"
  | "organize"
  | "hotspots"
  | "annotations"
  | "preview"
  | "publish";

export const IMAGE_WALKTHROUGH_WIZARD_STEPS: { id: ImageWalkthroughWizardStep; label: string }[] = [
  { id: "upload", label: "Upload Images" },
  { id: "enhance", label: "Enhance Images" },
  { id: "analyze", label: "Analyze Images" },
  { id: "organize", label: "Organize" },
  { id: "hotspots", label: "Hotspots" },
  { id: "annotations", label: "Annotations" },
  { id: "preview", label: "Preview Experience" },
  { id: "publish", label: "Publish Walkthrough" },
];

export interface ImageWalkthroughNode {
  id: string;
  experience_id: string;
  property_id: string;
  organization_id: string;
  image_url: string;
  original_image_url?: string | null;
  enhanced_image_url?: string | null;
  enhancement_status?: ImageWalkthroughEnhancementStatus | string | null;
  enhancement_error?: string | null;
  enhancement_model?: string | null;
  enhancement_completed_at?: string | null;
  thumbnail_url?: string | null;
  original_filename?: string | null;
  display_name?: string | null;
  room_type?: ImageWalkthroughRoomType | string | null;
  zone?: string | null;
  floor_label?: string | null;
  description?: string | null;
  media_type?: ImageWalkthroughMediaType;
  ai_confidence?: number | null;
  ai_reasoning?: string | null;
  ai_analysis?: Record<string, unknown> | null;
  node_order?: number;
  is_start_node?: boolean;
  created_at?: string;
  updated_at?: string;
}

export interface ImageWalkthroughHotspot {
  id: string;
  experience_id: string;
  from_node_id: string;
  to_node_id?: string | null;
  x_position: number;
  y_position: number;
  label: string;
  direction?: string | null;
  transition_type?: string | null;
  ai_suggested?: boolean;
  confidence?: number | null;
}

export interface ImageWalkthroughAnnotation {
  id: string;
  experience_id: string;
  node_id: string;
  x_position: number;
  y_position: number;
  title: string;
  description?: string | null;
  category?: string | null;
  icon_type?: string | null;
  ai_context?: string | null;
  knowledge_entry_id?: string | null;
  ai_suggested?: boolean;
  confidence?: number | null;
}

export interface ImageWalkthroughSettings {
  experience_id: string;
  start_node_id?: string | null;
  navigation_mode?: "hotspot" | "list" | "both";
  enable_minimap?: boolean;
  enable_ai_chat?: boolean;
  enable_annotations?: boolean;
  enable_depth_view?: boolean;
  panorama_ready?: boolean;
}

export interface ImageWalkthroughChecklist {
  experience_id: string;
  images_uploaded: boolean;
  images_enhanced?: boolean;
  ai_analysis_completed: boolean;
  start_node_selected: boolean;
  navigation_connected: boolean;
  annotations_added: boolean;
  preview_checked: boolean;
  ready_to_publish: boolean;
  warnings?: string[];
}

export interface ImageWalkthroughAIAnalysis {
  display_name: string;
  room_type: ImageWalkthroughRoomType | string;
  zone?: string | null;
  floor_label?: string | null;
  description?: string;
  visible_objects?: { name: string; category: string; confidence: number }[];
  suggested_annotations?: {
    title: string;
    description?: string;
    x_position: number;
    y_position: number;
    category?: string;
    confidence?: number;
  }[];
  suggested_hotspots?: {
    label: string;
    direction?: string;
    x_position: number;
    y_position: number;
    target_room_type_guess?: string;
    confidence?: number;
  }[];
  confidence: number;
  reasoning?: string;
  media_type?: ImageWalkthroughMediaType;
}
