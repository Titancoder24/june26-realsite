import { z } from "zod";
import { looksLikeScreenshotName } from "@/lib/walkthrough-scene-meta";
import type { WalkthroughMotionType } from "@/types/cinematic-walkthrough";

export const walkthroughMotionSchema = z.enum([
  "push_in", "pull_out", "truck_left", "truck_right", "pedestal_up", "pedestal_down",
  "slow_rotate", "cinematic_zoom", "static_premium", "depth_parallax",
]);

const MOTION_ALIASES: Record<string, WalkthroughMotionType> = {
  dolly_in: "push_in",
  zoom_in: "push_in",
  zoom: "cinematic_zoom",
  pan_left: "truck_left",
  pan_right: "truck_right",
  pan: "truck_left",
  tilt_up: "pedestal_up",
  tilt_down: "pedestal_down",
  rotate: "slow_rotate",
  static: "static_premium",
  parallax: "depth_parallax",
  drift: "depth_parallax",
};

export function normalizeMotionType(raw: unknown): WalkthroughMotionType {
  const key = String(raw ?? "push_in").toLowerCase().replace(/[\s-]+/g, "_");
  const parsed = walkthroughMotionSchema.safeParse(key);
  if (parsed.success) return parsed.data;
  return MOTION_ALIASES[key] ?? "push_in";
}

export function defaultVeoPrompt(roomType: string, title: string): string {
  return `Create a premium real-estate walkthrough motion from this ${roomType} image (${title}). Slow forward dolly with subtle parallax. Preserve exact room layout, architecture, furniture, walls, flooring, windows, lighting, and proportions. Do not add people. Do not change architecture. Do not distort objects.`;
}

export const ROOM_TYPES = [
  "exterior", "entrance", "living_room", "dining_area", "kitchen",
  "master_bedroom", "bedroom", "bedroom_2", "bedroom_3", "bathroom",
  "balcony", "staircase", "parking", "amenities", "utility", "study", "terrace", "garden", "pool", "unknown",
] as const;

export const scenePlanItemSchema = z.object({
  image_id: z.string(),
  room_type: z.string(),
  title: z.string(),
  description: z.string().default(""),
  caption: z.string().default(""),
  suggested_motion: walkthroughMotionSchema.default("push_in"),
  suggested_order: z.number().int().positive(),
  duration: z.number().min(4).max(8).default(6),
  veo_prompt: z.string().default(""),
  important_objects: z.array(z.string()).default([]),
  suggested_annotations: z.array(z.object({
    title: z.string(),
    x: z.number().min(0).max(1),
    y: z.number().min(0).max(1),
    category: z.string().optional(),
  })).default([]),
  quality_notes: z.string().default(""),
  classification_confidence: z.number().min(0).max(1).default(0.5),
  classification_reason: z.string().default(""),
  needs_review: z.boolean().default(false),
  include: z.boolean().default(true),
  warnings: z.array(z.string()).default([]),
});

export const walkthroughPlanSchema = z.object({
  tour_title: z.string().default("Property Walkthrough"),
  property_type: z.string().default("residential"),
  flow_warnings: z.array(z.string()).default([]),
  scenes: z.array(scenePlanItemSchema),
});

export type WalkthroughPlanPayload = z.infer<typeof walkthroughPlanSchema>;
export type ScenePlanItem = z.infer<typeof scenePlanItemSchema>;

function asRecord(value: unknown): Record<string, unknown> {
  return typeof value === "object" && value !== null ? (value as Record<string, unknown>) : {};
}

function normalizeRoomType(raw: unknown): string {
  const key = String(raw ?? "unknown").toLowerCase().replace(/[\s-]+/g, "_");
  if (ROOM_TYPES.includes(key as (typeof ROOM_TYPES)[number])) return key;
  const aliases: Record<string, string> = {
    dining: "dining_area",
    living: "living_room",
    master: "master_bedroom",
    bed: "bedroom",
    bath: "bathroom",
    foyer: "entrance",
    lobby: "entrance",
    garage: "parking",
    yard: "garden",
    patio: "balcony",
  };
  return aliases[key] ?? (key.includes("bed") ? "bedroom" : key.includes("bath") ? "bathroom" : "unknown");
}

function normalizeTitle(rawTitle: unknown, roomType: string, index: number): string {
  const title = String(rawTitle ?? "").trim();
  if (title && !looksLikeScreenshotName(title)) return title;
  const defaults: Record<string, string> = {
    exterior: "Exterior Front View",
    entrance: "Entrance",
    living_room: "Living Room",
    dining_area: "Dining Area",
    kitchen: "Kitchen",
    master_bedroom: "Master Bedroom",
    bedroom: index > 0 ? `Bedroom ${index}` : "Bedroom",
    bedroom_2: "Bedroom 2",
    bedroom_3: "Bedroom 3",
    bathroom: "Bathroom",
    balcony: "Balcony",
    staircase: "Staircase",
    parking: "Parking",
    amenities: "Amenities",
  };
  return defaults[roomType] ?? `Room ${index + 1}`;
}

function normalizeSceneItem(raw: unknown, index: number, imageIds: string[]): ScenePlanItem {
  const item = asRecord(raw);
  const roomType = normalizeRoomType(item.room_type);
  const title = normalizeTitle(item.title, roomType, index + 1);
  const imageId = String(item.image_id ?? imageIds[index] ?? imageIds[0] ?? "");
  const veo = String(item.veo_prompt ?? "").trim() || defaultVeoPrompt(roomType, title);
  const confidenceRaw = Number(item.classification_confidence);
  const classification_confidence = Number.isFinite(confidenceRaw)
    ? Math.min(1, Math.max(0, confidenceRaw))
    : 0.5;
  const classification_reason = String(item.classification_reason ?? item.quality_notes ?? "").trim();
  const needs_review = item.needs_review === true
    || classification_confidence < 0.65
    || roomType === "unknown"
    || looksLikeScreenshotName(title);

  const annotations = Array.isArray(item.suggested_annotations)
    ? item.suggested_annotations.map((ann) => {
        const a = asRecord(ann);
        return {
          title: String(a.title ?? "Feature"),
          x: Math.min(1, Math.max(0, Number(a.x ?? 0.5))),
          y: Math.min(1, Math.max(0, Number(a.y ?? 0.5))),
          category: a.category ? String(a.category) : undefined,
        };
      })
    : [];

  return {
    image_id: imageId,
    room_type: roomType,
    title,
    description: String(item.description ?? ""),
    caption: String(item.caption ?? title),
    suggested_motion: normalizeMotionType(item.suggested_motion),
    suggested_order: Math.max(1, Number(item.suggested_order) || index + 1),
    duration: Math.min(8, Math.max(4, Number(item.duration) || 6)),
    veo_prompt: veo,
    important_objects: Array.isArray(item.important_objects) ? item.important_objects.map(String) : [],
    suggested_annotations: annotations,
    quality_notes: String(item.quality_notes ?? ""),
    classification_confidence,
    classification_reason: classification_reason || (needs_review ? "Could not confidently classify this image." : "Classified from visible room features."),
    needs_review,
    include: item.include !== false,
    warnings: Array.isArray(item.warnings) ? item.warnings.map(String) : [],
  };
}

export function buildFallbackPlan(
  images: { id: string; file_name: string }[],
  propertyType = "residential",
): WalkthroughPlanPayload {
  return {
    tour_title: "Property Walkthrough",
    property_type: propertyType,
    flow_warnings: ["AI planner returned an incomplete plan — created one scene per uploaded image."],
    scenes: images.map((img, i) => ({
      image_id: img.id,
      room_type: "unknown",
      title: `Room ${i + 1} — Needs Review`,
      description: `Walkthrough scene ${i + 1}`,
      caption: `Scene ${i + 1}`,
      suggested_motion: "push_in",
      suggested_order: i + 1,
      duration: 6,
      veo_prompt: defaultVeoPrompt("room", `Room ${i + 1}`),
      important_objects: [],
      suggested_annotations: [],
      quality_notes: "",
      classification_confidence: 0.3,
      classification_reason: "AI planner unavailable — please rename and classify manually.",
      needs_review: true,
      include: true,
      warnings: ["needs_review"],
    })),
  };
}

export function parseWalkthroughPlan(raw: unknown, imageIds: string[], propertyType = "residential"): WalkthroughPlanPayload {
  const root = asRecord(raw);
  const rawScenes = Array.isArray(root.scenes) ? root.scenes : [];

  let scenes = rawScenes.map((scene, index) => normalizeSceneItem(scene, index, imageIds));

  if (!scenes.length && imageIds.length) {
    return buildFallbackPlan(
      imageIds.map((id, i) => ({ id, file_name: `Scene ${i + 1}` })),
      propertyType,
    );
  }

  const usedIds = new Set<string>();
  scenes = scenes.map((scene, index) => {
    let imageId = scene.image_id;
    if (!imageIds.includes(imageId)) {
      const next = imageIds.find((id) => !usedIds.has(id)) ?? imageIds[index] ?? imageIds[0];
      imageId = next ?? imageId;
    }
    usedIds.add(imageId);
    return { ...scene, image_id: imageId };
  });

  const parsed = walkthroughPlanSchema.safeParse({
    tour_title: String(root.tour_title ?? "Property Walkthrough"),
    property_type: String(root.property_type ?? propertyType),
    flow_warnings: Array.isArray(root.flow_warnings) ? root.flow_warnings.map(String) : [],
    scenes,
  });

  if (parsed.success) return parsed.data;

  return buildFallbackPlan(
    imageIds.map((id, i) => ({ id, file_name: `Scene ${i + 1}` })),
    propertyType,
  );
}
