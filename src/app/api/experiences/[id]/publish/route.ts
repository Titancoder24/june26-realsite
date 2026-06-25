import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { withAuth, jsonError, slugify } from "@/lib/api-utils";
import { env } from "@/lib/env";
import { ensureWalkthroughChecklist, refreshWalkthroughChecklist } from "@/services/walkthrough.service";
import { refreshImageWalkthroughChecklist } from "@/services/image-walkthrough.service";
import { isPlatformAdmin } from "@/lib/auth/platform-scope";

export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  return withAuth(async (profile) => {
    const admin = createAdminClient();
    let expQuery = admin.from("experiences").select("*, properties(name)").eq("id", id);
    if (!isPlatformAdmin(profile)) {
      expQuery = expQuery.eq("organization_id", profile.organization_id!);
    }
    const { data: exp, error } = await expQuery.single();
    if (error || !exp) return jsonError("Not found", 404);

    const propertyName = (exp.properties as { name?: string } | null)?.name ?? "property";
    let slug = exp.slug as string | null;
    if (!slug) {
      slug = slugify(`${propertyName}-walkthrough-${Date.now().toString(36)}`);
    }

    if (exp.type === "cinematic_walkthrough") {
      await ensureWalkthroughChecklist(id);
      const checklist = await refreshWalkthroughChecklist(id);
      if (!checklist.images_uploaded || !checklist.scenes_created) {
        return jsonError("Upload images and create scenes before publishing", 400);
      }
    }

    if (exp.type === "image_walkthrough") {
      const checklist = await refreshImageWalkthroughChecklist(id);
      if (!checklist.ready_to_publish) {
        return jsonError("Complete the Image Walkthrough checklist before publishing", 400);
      }
    }

    const baseUrl = env.NEXT_PUBLIC_APP_URL.replace(/\/$/, "");
    const publishedUrl = exp.type === "cinematic_walkthrough"
      ? `${baseUrl}/walkthrough/${slug}`
      : exp.type === "image_walkthrough"
        ? `${baseUrl}/image-walkthrough/${slug}`
        : `${baseUrl}/view/${slug}`;

    if (exp.primary_experience) {
      await admin.from("experiences").update({ primary_experience: false }).eq("property_id", exp.property_id);
    }

    const { data, error: updateError } = await admin.from("experiences").update({
      slug,
      status: "published",
      published_url: publishedUrl,
      primary_experience: true,
      updated_at: new Date().toISOString(),
    }).eq("id", id).select().single();

    if (updateError) return jsonError(updateError.message, 500);

    await admin.from("properties").update({ publish_status: "published" }).eq("id", exp.property_id);

    if (exp.type === "cinematic_walkthrough") {
      await refreshWalkthroughChecklist(id);
    }

    return NextResponse.json({ ...data, publishedUrl });
  }, "project_manager");
}
