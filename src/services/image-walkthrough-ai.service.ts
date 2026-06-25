import { vertexAIService } from "@/services/vertex-ai.service";
import type { ImageWalkthroughAIAnalysis } from "@/types/image-walkthrough";
import { IMAGE_WALKTHROUGH_ROOM_TYPES, IMAGE_WALKTHROUGH_ZONES } from "@/types/image-walkthrough";

const ANALYSIS_PROMPT = `You analyze property listing photos for an interactive Image Walkthrough (Google Maps / Street View inspired navigation between still images).

For each image, return JSON only:
{
  "display_name": "Living Room",
  "room_type": "living_room",
  "zone": "common_area",
  "floor_label": null,
  "description": "Short factual description of what is visible.",
  "media_type": "flat",
  "visible_objects": [{"name": "Sofa", "category": "furniture", "confidence": 0.9}],
  "suggested_annotations": [{
    "title": "Three-seater sofa",
    "description": "Comfortable seating in the living area.",
    "x_position": 0.42,
    "y_position": 0.68,
    "category": "furniture",
    "confidence": 0.75
  }],
  "suggested_hotspots": [{
    "label": "Go to Kitchen",
    "direction": "forward",
    "x_position": 0.78,
    "y_position": 0.52,
    "target_room_type_guess": "kitchen",
    "confidence": 0.55
  }],
  "confidence": 0.87,
  "reasoning": "Why you chose this room type."
}

Rules:
- room_type must be one of: ${IMAGE_WALKTHROUGH_ROOM_TYPES.join(", ")}
- zone must be one of: ${IMAGE_WALKTHROUGH_ZONES.join(", ")} or null
- x_position and y_position are normalized 0-1 (top-left origin)
- If unsure, use display_name "Needs Review", room_type "unknown", confidence below 0.6
- Do NOT invent property facts (price, size, brand names) not visible in the image
- media_type: "equirectangular" only if image is a 360° panorama (2:1 aspect), else "flat"
- Hotspot targets are guesses only — do not assume links exist`;

export async function analyzeImageWalkthroughNode(imageUrl: string): Promise<ImageWalkthroughAIAnalysis> {
  const raw = await vertexAIService.planScenes(
    [{ id: "node", url: imageUrl, file_name: "photo.jpg" }],
    { promptText: ANALYSIS_PROMPT },
  );

  const parsed = JSON.parse(raw) as ImageWalkthroughAIAnalysis;
  const confidence = Number(parsed.confidence);
  const lowConfidence = !Number.isFinite(confidence) || confidence < 0.6;

  return {
    display_name: lowConfidence ? "Needs Review" : String(parsed.display_name ?? "Needs Review"),
    room_type: parsed.room_type ?? "unknown",
    zone: parsed.zone ?? null,
    floor_label: parsed.floor_label ?? null,
    description: parsed.description ?? "",
    media_type: parsed.media_type === "equirectangular" ? "equirectangular" : "flat",
    visible_objects: Array.isArray(parsed.visible_objects) ? parsed.visible_objects : [],
    suggested_annotations: Array.isArray(parsed.suggested_annotations) ? parsed.suggested_annotations : [],
    suggested_hotspots: Array.isArray(parsed.suggested_hotspots) ? parsed.suggested_hotspots : [],
    confidence: Number.isFinite(confidence) ? Math.min(1, Math.max(0, confidence)) : 0.5,
    reasoning: parsed.reasoning ?? "",
  };
}

export function guessTargetNodeId(
  nodes: { id: string; room_type?: string | null }[],
  targetRoomTypeGuess?: string,
  minConfidence = 0.75,
  hotspotConfidence = 0,
): string | null {
  if (!targetRoomTypeGuess || hotspotConfidence < minConfidence) return null;
  const match = nodes.find((n) => n.room_type === targetRoomTypeGuess);
  return match?.id ?? null;
}
