/**
 * Agent-assisted annotation flow — suggests pins, doorway links, and copy.
 * Rules-first for offline speed; can be extended with /api/ai/chat for richer suggestions.
 */

import { getPin, isNavigationPin } from "@/lib/pins/pin-library";
import type { PinTypeId, SceneAnnotation } from "@/types/annotations";

export interface SceneContext {
  id: string;
  room_name: string;
  room_type?: string;
}

export interface AnnotationSuggestion {
  type: PinTypeId;
  label: string;
  reason: string;
  priority: number;
}

const ROOM_PIN_SUGGESTIONS: Record<string, PinTypeId[]> = {
  living_room: ["sofa", "window", "tv", "city_view", "doorway"],
  bedroom: ["bed", "wardrobe", "window", "ac", "doorway"],
  kitchen: ["stove", "fridge", "sink", "counter", "window"],
  bathroom: ["shower", "toilet", "sink", "mirror", "vent"],
  balcony: ["railing", "city_view", "garden_view", "balcony_access"],
  dining: ["dining_table", "chair", "light_ceiling", "doorway"],
  office: ["desk", "chair", "window", "bookshelf"],
  hallway: ["doorway", "hallway", "light_ceiling"],
  entrance: ["door", "doorway", "lobby"],
  terrace: ["terrace_access", "panorama", "railing"],
  default: ["info", "window", "doorway", "dimension"],
};

export function suggestPinsForRoom(roomName: string, roomType?: string): AnnotationSuggestion[] {
  const key = (roomType ?? roomName).toLowerCase().replace(/\s+/g, "_");
  const types =
    ROOM_PIN_SUGGESTIONS[key] ??
    ROOM_PIN_SUGGESTIONS[Object.keys(ROOM_PIN_SUGGESTIONS).find((k) => key.includes(k)) ?? ""] ??
    ROOM_PIN_SUGGESTIONS.default;

  return types.map((type, i) => {
    const pin = getPin(type);
    return {
      type,
      label: pin.defaultLabel ?? pin.label,
      reason: `Common ${pin.category} tag for ${roomName}`,
      priority: types.length - i,
    };
  });
}

export function suggestDoorwayLinks(scenes: SceneContext[]): { fromId: string; toId: string; label: string }[] {
  const links: { fromId: string; toId: string; label: string }[] = [];
  for (let i = 0; i < scenes.length - 1; i++) {
    links.push({
      fromId: scenes[i].id,
      toId: scenes[i + 1].id,
      label: `To ${scenes[i + 1].room_name}`,
    });
  }
  return links;
}

export function buildAutoAnnotations(
  scenes: SceneContext[],
  existing: Record<string, SceneAnnotation[]>,
): { sceneId: string; annotations: SceneAnnotation[] }[] {
  const doorwayLinks = suggestDoorwayLinks(scenes);
  return scenes.map((scene) => {
    const current = existing[scene.id] ?? [];
    const hasNav = current.some((a) => isNavigationPin(a.type));
    const additions: SceneAnnotation[] = [];

    if (!hasNav) {
      const link = doorwayLinks.find((l) => l.fromId === scene.id);
      if (link) {
        additions.push({
          id: crypto.randomUUID(),
          type: "doorway",
          label: link.label,
          yaw: 0,
          pitch: 0,
          targetSceneId: link.toId,
        });
      }
    }

    const pinSuggestions = suggestPinsForRoom(scene.room_name, scene.room_type);
    for (const s of pinSuggestions.slice(0, 2)) {
      if (current.some((a) => a.type === s.type) || additions.some((a) => a.type === s.type)) continue;
      additions.push({
        id: crypto.randomUUID(),
        type: s.type,
        label: s.label,
        yaw: 0,
        pitch: 0,
        payload: { description: s.reason },
      });
    }

    return { sceneId: scene.id, annotations: [...current, ...additions] };
  });
}

export function describeAnnotation(type: PinTypeId, roomName: string): string {
  const pin = getPin(type);
  const templates: Partial<Record<PinTypeId, string>> = {
    window: `Natural light and outlook from this window in ${roomName}.`,
    doorway: `Connect to the adjacent space from ${roomName}.`,
    carpet_area: `Carpet area measurement for this unit.`,
    city_view: `Premium city-facing view from ${roomName}.`,
    ac: `Split AC unit — energy efficient cooling.`,
    pricing: `Pricing details available on request.`,
  };
  return templates[type] ?? `${pin.label} in ${roomName}. Tap for details.`;
}

/** UI flow stages for the annotation studio */
export type AnnotationFlowStep = "browse" | "pick_pin" | "place" | "edit" | "review";

export const ANNOTATION_FLOW: { step: AnnotationFlowStep; label: string; hint: string }[] = [
  { step: "browse", label: "Browse", hint: "Look around the room and find features to tag" },
  { step: "pick_pin", label: "Pick Pin", hint: "Choose a pin type — window, doorway, fixture, etc." },
  { step: "place", label: "Place", hint: "Tap exactly on the feature in the panorama" },
  { step: "edit", label: "Edit", hint: "Add label, description, media, or link to another room" },
  { step: "review", label: "Review", hint: "Check all pins before publishing" },
];
