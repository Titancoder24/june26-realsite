import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { withAuth, jsonError } from "@/lib/api-utils";

export async function GET(req: Request) {
  return withAuth(async (profile) => {
    const propertyId = new URL(req.url).searchParams.get("propertyId");
    const admin = createAdminClient();
    let q = admin.from("media_assets").select("*").eq("organization_id", profile.organization_id!).order("created_at", { ascending: false });
    if (propertyId) q = q.eq("property_id", propertyId);
    const { data, error } = await q;
    if (error) return jsonError(error.message, 500);
    return NextResponse.json(data);
  }, "project_manager");
}
