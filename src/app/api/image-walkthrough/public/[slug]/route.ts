import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { jsonError } from "@/lib/api-utils";
import { loadImageWalkthroughBundle } from "@/services/image-walkthrough.service";

export async function GET(req: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const preview = new URL(req.url).searchParams.get("preview") === "1";
  const admin = createAdminClient();

  let query = admin
    .from("experiences")
    .select("id, type, status, slug, organization_id, property_id, properties(name, projects(name, branding))")
    .eq("type", "image_walkthrough")
    .eq("slug", slug);

  if (preview) {
    query = query.in("status", ["published", "ready_for_review"]);
  } else {
    query = query.eq("status", "published");
  }

  const { data: exp, error } = await query.single();
  if (error || !exp) return jsonError("Image walkthrough not found", 404);

  const bundle = await loadImageWalkthroughBundle(exp.id, { publicOnly: true });

  return NextResponse.json({
    ...exp,
    ...bundle,
  });
}
