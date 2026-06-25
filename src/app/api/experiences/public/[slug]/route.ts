import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { jsonError } from "@/lib/api-utils";
import { syncSceneVideosFromJobsForExperience } from "@/services/walkthrough-video-sync.service";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function GET(req: Request, { params }: { params: Promise<{ slug: string }> }) {
  try {
  const { slug } = await params;
  const preview = new URL(req.url).searchParams.get("preview") === "1";
  const admin = createAdminClient();

  const select = `
      id, type, status, slug, viewer_config, organization_id, property_id,
      properties(id, name, project_id, projects(name, branding, organizations(branding))),
      tour_360_scenes(*),
      property_scenes(*, scene_annotations(*)),
      walkthrough_scenes(*, walkthrough_annotations(*)),
      splat_worlds(*),
      floor_maps(*),
      checkpoints(*)
    `;

  const isUuid = UUID_RE.test(slug);
  let lookup = admin.from("experiences").select("id, status");
  lookup = isUuid ? lookup.eq("id", slug) : lookup.eq("slug", slug);
  const { data: found } = await lookup.maybeSingle();

  if (!found) return jsonError("Experience not found", 404);

  if (
    preview &&
    (found.status === "draft" || found.status === "processing")
  ) {
    const { error: updateError } = await admin
      .from("experiences")
      .update({ status: "ready_for_review", updated_at: new Date().toISOString() })
      .eq("id", found.id);
    if (updateError) {
      console.error("[experiences/public] preview status update failed:", updateError);
    }
  }

  let query = admin.from("experiences").select(select).eq("id", found.id);

  if (preview) {
    // Studio preview: slug was resolved — do not re-filter by publish status (avoids race
    // where draft/processing → ready_for_review update has not yet become visible).
    query = query.neq("status", "archived");
  } else {
    query = query.eq("status", "published");
  }

  const { data: exp, error } = await query.single();

  if (error || !exp) return jsonError("Experience not found", 404);

  if (exp.type === "cinematic_walkthrough") {
    try {
      await syncSceneVideosFromJobsForExperience(exp.id);
    } catch (syncErr) {
      console.error("[experiences/public] video sync failed:", syncErr);
    }
  }

  if (
    exp.type === "cinematic_walkthrough" &&
    (!Array.isArray(exp.walkthrough_scenes) || exp.walkthrough_scenes.length === 0)
  ) {
    const { data: scenes } = await admin
      .from("walkthrough_scenes")
      .select("*, walkthrough_annotations(*)")
      .eq("experience_id", exp.id)
      .order("scene_order");
    exp.walkthrough_scenes = scenes ?? [];
  }

  if (Array.isArray(exp.walkthrough_scenes)) {
    exp.walkthrough_scenes = exp.walkthrough_scenes.filter(
      (scene: { scene_status?: string | null }) => scene.scene_status !== "excluded",
    );
  }

  return NextResponse.json(exp);
  } catch (err) {
    console.error("[experiences/public]", err);
    return jsonError(err instanceof Error ? err.message : "Failed to load experience", 500);
  }
}
