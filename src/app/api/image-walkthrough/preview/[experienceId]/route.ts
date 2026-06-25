import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { withAuth, jsonError } from "@/lib/api-utils";
import { isPlatformAdmin } from "@/lib/auth/platform-scope";

/** Promote draft → ready_for_review so the public preview URL works (same pattern as cinematic walkthrough). */
export async function POST(_req: Request, { params }: { params: Promise<{ experienceId: string }> }) {
  return withAuth(async (profile) => {
    const { experienceId } = await params;
    const admin = createAdminClient();

    let expQuery = admin
      .from("experiences")
      .select("id, slug, status, type, organization_id")
      .eq("id", experienceId);
    if (!isPlatformAdmin(profile)) {
      expQuery = expQuery.eq("organization_id", profile.organization_id!);
    }
    const { data: exp, error } = await expQuery.single();

    if (error || !exp) return jsonError("Experience not found", 404);
    if (exp.type !== "image_walkthrough") return jsonError("Not an Image Walkthrough experience", 400);

    if (exp.status === "draft" || exp.status === "processing") {
      const { error: updateError } = await admin
        .from("experiences")
        .update({ status: "ready_for_review", updated_at: new Date().toISOString() })
        .eq("id", experienceId);
      if (updateError) return jsonError(updateError.message, 500);
    }

    const slug = exp.slug ?? experienceId;
    return NextResponse.json({
      previewUrl: `/image-walkthrough/${slug}?preview=1`,
      slug,
      status: exp.status === "draft" || exp.status === "processing" ? "ready_for_review" : exp.status,
    });
  }, "project_manager");
}
