export type ExperienceType =
  | "360_realistic"
  | "worldlabs_splat"
  | "immersive_world"
  | "mobile_360_capture"
  | "scene_intelligence"
  | "cinematic_walkthrough"
  | "image_walkthrough";

export function isSplatExperience(type: ExperienceType | string): boolean {
  return type === "worldlabs_splat" || type === "immersive_world";
}

export function isSceneIntelligence(type: ExperienceType | string): boolean {
  return type === "scene_intelligence";
}

export function isCinematicWalkthrough(type: ExperienceType | string): boolean {
  return type === "cinematic_walkthrough";
}

export function isImageWalkthrough(type: ExperienceType | string): boolean {
  return type === "image_walkthrough";
}

export type CaptureRoomStatus = "not_started" | "capturing" | "processing" | "needs_retake" | "complete";

export interface CaptureRoom {
  id: string;
  experience_id: string;
  property_id: string;
  organization_id: string;
  room_name: string;
  room_type: string;
  status: CaptureRoomStatus;
  quality_score?: string;
  scene_id?: string;
  notes?: string;
  sort_order: number;
}
export type ExperienceStatus = "draft" | "processing" | "ready_for_review" | "published" | "unpublished" | "archived" | "failed";

export type WorldLabsJobStatus =
  | "draft"
  | "media_uploaded"
  | "validating_media"
  | "preparing_worldlabs_upload"
  | "worldlabs_upload_ready"
  | "worldlabs_media_uploaded"
  | "worldlabs_generation_requested"
  | "worldlabs_processing"
  | "worldlabs_succeeded"
  | "downloading_assets"
  | "optimizing_viewer_assets"
  | "ready_for_review"
  | "published"
  | "media_validation_failed"
  | "worldlabs_upload_failed"
  | "worldlabs_generation_failed"
  | "worldlabs_polling_failed"
  | "asset_download_failed"
  | "viewer_optimization_failed"
  | "manual_review_required";

export type KnowledgeCategory =
  | "project_details"
  | "unit_details"
  | "pricing"
  | "availability"
  | "amenities"
  | "possession"
  | "legal"
  | "rera"
  | "bank_approvals"
  | "nri_process"
  | "financing"
  | "developer_profile"
  | "faq"
  | "objection"
  | "room_context"
  | "checkpoint_context"
  | "restricted_topic"
  | "fallback";

export type UserRole =
  | "organization_admin"
  | "project_manager"
  | "sales_manager"
  | "sales_agent"
  | "marketing_manager"
  | "viewer"
  | "platform_admin";

export type CheckpointType =
  | "info"
  | "room_detail"
  | "view"
  | "amenity"
  | "ai_trigger"
  | "cta"
  | "legal_disclaimer"
  | "pricing"
  | "internal_only";

export type LeadStatus = "new" | "contacted" | "qualified" | "hot" | "callback_requested" | "lost" | "converted";

export type InventoryStatus = "available" | "on_hold" | "booked" | "sold" | "blocked";

export const INVENTORY_STATUSES: InventoryStatus[] = ["available", "on_hold", "booked", "sold", "blocked"];

export type SiteVisitType = "in_person" | "video_call";

export type SiteVisitStatus =
  | "requested"
  | "confirmed"
  | "rescheduled"
  | "completed"
  | "cancelled"
  | "no_show";

export interface SiteVisit {
  id: string;
  organization_id: string;
  property_id: string;
  project_id: string | null;
  lead_id: string | null;
  session_id: string | null;
  assigned_agent: string | null;
  webrtc_session_id: string | null;
  visit_type: SiteVisitType;
  status: SiteVisitStatus;
  scheduled_at: string;
  duration_minutes: number;
  visitor_name: string | null;
  visitor_phone: string | null;
  visitor_email: string | null;
  party_size: number | null;
  notes: string | null;
  meeting_url: string | null;
  reminder_sent: boolean;
  cancelled_reason: string | null;
  created_at: string;
  updated_at: string;
}

export interface InventoryChange {
  id: string;
  organization_id: string;
  property_id: string;
  changed_by: string | null;
  lead_id: string | null;
  from_status: string | null;
  to_status: InventoryStatus;
  reason: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
}

export interface SpatialGenerationInput {
  experienceId: string;
  propertyId: string;
  organizationId: string;
  mediaAssetIds: string[];
  prompt?: string;
  model?: string;
}

export interface SpatialGenerationResult {
  engine: ExperienceType;
  status: ExperienceStatus | WorldLabsJobStatus;
  jobId?: string;
  worldId?: string;
  assets?: Record<string, string>;
}

export interface RAGContext {
  id: string;
  category: KnowledgeCategory;
  title: string;
  content: string;
  sourceType: string;
  sourceId?: string;
  score: number;
}

export interface AIResponse {
  answer: string;
  retrievedSources: RAGContext[];
  confidenceScore: number;
  sensitiveTopic: boolean;
  fallbackUsed: boolean;
  humanEscalation: boolean;
  navigationIntent?: { type: string; targetId?: string };
}

export interface IntentSignal {
  type: string;
  weight: number;
  description: string;
}
