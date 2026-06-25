import { NextResponse } from "next/server";
import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";
import { withAuth, jsonError, slugify, formatDbError } from "@/lib/api-utils";
import { getWalkthroughExperienceSummaries, syncSceneVideosFromJobsForExperience } from "@/services/walkthrough-video-sync.service";

const schema = z.object({
  property_id: z.string().uuid(),
  type: z.enum(["360_realistic", "worldlabs_splat", "immersive_world", "mobile_360_capture", "scene_intelligence", "cinematic_walkthrough", "image_walkthrough"]),
  primary_experience: z.boolean().optional(),
});

export async function GET(req: Request) {
  return withAuth(async (profile) => {
    const url = new URL(req.url);
    const propertyId = url.searchParams.get("propertyId");
    const admin = createAdminClient();
    let q = admin.from("experiences").select("*, property_id, properties(name, project_id)").eq("organization_id", profile.organization_id!);
    if (propertyId) q = q.eq("property_id", propertyId);
    const { data, error } = await q.order("updated_at", { ascending: false });
    if (error) return jsonError(error.message, 500);

    const walkthroughIds = (data ?? [])
      .filter((e) => e.type === "cinematic_walkthrough")
      .map((e) => e.id as string);
    for (const id of walkthroughIds.slice(0, 25)) {
      await syncSceneVideosFromJobsForExperience(id);
    }
    const summaries = await getWalkthroughExperienceSummaries(walkthroughIds);

    const enriched = (data ?? []).map((e) =>
      e.type === "cinematic_walkthrough"
        ? { ...e, walkthrough_summary: summaries[e.id as string] ?? null }
        : e,
    );

    return NextResponse.json(enriched);
  });
}

export async function POST(req: Request) {
  return withAuth(async (profile) => {
    const body = schema.parse(await req.json());
    const admin = createAdminClient();

    const { data: property } = await admin
      .from("properties")
      .select("name, organization_id")
      .eq("id", body.property_id)
      .single();

    const organizationId = profile.organization_id ?? property?.organization_id;
    if (!organizationId) return jsonError("Organization not found for this property", 400);

    const slug = slugify(`${property?.name ?? "property"}-${body.type}-${Date.now().toString(36)}`);

    const { data, error } = await admin.from("experiences").insert({
      property_id: body.property_id,
      organization_id: organizationId,
      type: body.type,
      status: "draft",
      slug,
      primary_experience: body.primary_experience ?? false,
    }).select().single();

    if (error) return jsonError(formatDbError(error.message), 500);
    return NextResponse.json(data, { status: 201 });
  }, "project_manager");
}
