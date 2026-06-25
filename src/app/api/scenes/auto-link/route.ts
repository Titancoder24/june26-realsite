import { NextResponse } from "next/server";
import { z } from "zod";
import { withAuth, jsonError } from "@/lib/api-utils";
import { createAdminClient } from "@/lib/supabase/admin";
import { buildAutoAnnotations } from "@/lib/annotations/annotation-agent";
import { normalizeAnnotations } from "@/types/annotations";
import type { SceneAnnotation } from "@/types/annotations";

const schema = z.object({
  experience_id: z.string().uuid(),
});

/**
 * Agentic scene linker — auto-creates doorway navigation pins between
 * consecutive scenes and syncs floor map pins to scene IDs.
 */
export async function POST(req: Request) {
  return withAuth(async () => {
    const body = schema.parse(await req.json());
    const admin = createAdminClient();

    const { data: scenes, error } = await admin
      .from("tour_360_scenes")
      .select("id, room_name, hotspots, sort_order")
      .eq("experience_id", body.experience_id)
      .order("sort_order");

    if (error) return jsonError(error.message, 500);
    if (!scenes?.length) return jsonError("No scenes to link", 400);

    const existing: Record<string, SceneAnnotation[]> = {};
    for (const s of scenes) {
      existing[s.id] = normalizeAnnotations((s.hotspots as SceneAnnotation[]) ?? []);
    }

    const updates = buildAutoAnnotations(
      scenes.map((s) => ({ id: s.id, room_name: s.room_name })),
      existing,
    );

    let linkedCount = 0;
    for (const { sceneId, annotations } of updates) {
      if (!annotations.length) continue;
      const merged = [...(existing[sceneId] ?? []), ...annotations];
      await admin.from("tour_360_scenes").update({ hotspots: merged }).eq("id", sceneId);
      linkedCount += annotations.length;
    }

    // Sync floor map pins to scenes by name match
    const { data: floorMaps } = await admin
      .from("floor_maps")
      .select("*")
      .eq("experience_id", body.experience_id);

    let pinsSynced = 0;
    for (const map of floorMaps ?? []) {
      const pins = (map.pins as { id: string; name: string; x: number; y: number; sceneId?: string }[]) ?? [];
      let changed = false;
      const updated = pins.map((pin) => {
        if (pin.sceneId) return pin;
        const match = scenes.find(
          (s) => s.room_name.toLowerCase() === pin.name.toLowerCase() ||
            pin.name.toLowerCase().includes(s.room_name.toLowerCase().split(" ")[0]),
        );
        if (match) {
          changed = true;
          pinsSynced++;
          return { ...pin, sceneId: match.id };
        }
        return pin;
      });
      if (changed) {
        await admin.from("floor_maps").update({ pins: updated }).eq("id", map.id);
      }
    }

    return NextResponse.json({
      scenes: scenes.length,
      navigationPinsAdded: linkedCount,
      floorMapPinsSynced: pinsSynced,
    });
  }, "project_manager");
}
