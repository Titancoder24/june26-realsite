import { NextResponse } from "next/server";
import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";
import { withAuth, jsonError } from "@/lib/api-utils";

const schema = z.object({
  project_id: z.string().uuid(),
  name: z.string().min(1),
  property_type: z.string().optional(),
  unit_type: z.string().optional(),
  configuration: z.string().optional(),
  tower: z.string().optional(),
  floor: z.string().optional(),
  facing: z.string().optional(),
  area: z.number().optional(),
  price_min: z.number().optional(),
  price_max: z.number().optional(),
  availability: z.string().optional(),
  furnishing_status: z.string().optional(),
});

export async function GET(req: Request) {
  return withAuth(async (profile) => {
    const url = new URL(req.url);
    const projectId = url.searchParams.get("projectId");
    const admin = createAdminClient();
    let q = admin.from("properties").select("*, experiences(id, type, status, slug, published_url, primary_experience)").eq("organization_id", profile.organization_id!);
    if (projectId) q = q.eq("project_id", projectId);
    const { data, error } = await q.order("updated_at", { ascending: false });
    if (error) return jsonError(error.message, 500);
    return NextResponse.json(data);
  });
}

export async function POST(req: Request) {
  return withAuth(async (profile) => {
    const body = schema.parse(await req.json());
    const admin = createAdminClient();
    const { data, error } = await admin.from("properties").insert({
      ...body,
      organization_id: profile.organization_id,
    }).select().single();
    if (error) return jsonError(error.message, 500);
    return NextResponse.json(data, { status: 201 });
  }, "project_manager");
}
