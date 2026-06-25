import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { jsonError } from "@/lib/api-utils";

/** Stream splat file from Supabase — same-origin for reliable Spark loading. */
export async function GET(req: Request) {
  const experienceId = new URL(req.url).searchParams.get("experienceId");
  if (!experienceId) return jsonError("experienceId required", 400);

  const admin = createAdminClient();
  const { data: exp } = await admin
    .from("experiences")
    .select("id, status")
    .eq("id", experienceId)
    .single();

  if (!exp || !["published", "ready_for_review"].includes(exp.status)) {
    return jsonError("Experience not available", 404);
  }

  const { data: splat } = await admin
    .from("splat_worlds")
    .select("spz_full_res_url, spz_500k_url")
    .eq("experience_id", experienceId)
    .single();

  const fileUrl = splat?.spz_full_res_url ?? splat?.spz_500k_url;
  if (!fileUrl) return jsonError("Splat file not found", 404);

  const fileRes = await fetch(fileUrl);
  if (!fileRes.ok) return jsonError("Failed to fetch splat file", 502);

  const buffer = await fileRes.arrayBuffer();
  return new NextResponse(buffer, {
    headers: {
      "Content-Type": "application/octet-stream",
      "Content-Length": String(buffer.byteLength),
      "Cache-Control": "public, max-age=86400",
      "Access-Control-Allow-Origin": "*",
    },
  });
}
