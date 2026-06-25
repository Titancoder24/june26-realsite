import { NextResponse } from "next/server";
import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";
import { withAuth, jsonError } from "@/lib/api-utils";

const schema = z.object({
  property_id: z.string().uuid(),
  experience_id: z.string().uuid().optional(),
  image_url: z.string().url(),
  name: z.string().optional(),
  pins: z.array(z.unknown()).optional(),
});

export async function GET(req: Request) {
  return withAuth(async () => {
    const propertyId = new URL(req.url).searchParams.get("propertyId");
    const experienceId = new URL(req.url).searchParams.get("experienceId");
    const admin = createAdminClient();
    let q = admin.from("floor_maps").select("*");
    if (propertyId) q = q.eq("property_id", propertyId);
    if (experienceId) q = q.eq("experience_id", experienceId);
    const { data, error } = await q;
    if (error) return jsonError(error.message, 500);
    return NextResponse.json(data);
  });
}

export async function POST(req: Request) {
  return withAuth(async () => {
    const body = schema.parse(await req.json());
    const admin = createAdminClient();
    const { data, error } = await admin.from("floor_maps").insert(body).select().single();
    if (error) return jsonError(error.message, 500);
    if (body.experience_id) {
      await admin.from("experiences").update({ floor_map_id: data.id }).eq("id", body.experience_id);
    }
    return NextResponse.json(data, { status: 201 });
  }, "project_manager");
}
