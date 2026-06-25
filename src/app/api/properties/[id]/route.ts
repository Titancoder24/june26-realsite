import { NextResponse } from "next/server";
import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";
import { withAuth, jsonError } from "@/lib/api-utils";

const schema = z.object({
  name: z.string().optional(),
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
  publish_status: z.string().optional(),
});

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return withAuth(async (profile) => {
    const admin = createAdminClient();
    const { data, error } = await admin.from("properties").select("*, experiences(*), projects(name)").eq("id", id).eq("organization_id", profile.organization_id!).single();
    if (error) return jsonError("Not found", 404);
    return NextResponse.json(data);
  });
}

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return withAuth(async (profile) => {
    const body = schema.parse(await req.json());
    const admin = createAdminClient();
    const { data, error } = await admin.from("properties").update({ ...body, updated_at: new Date().toISOString() }).eq("id", id).eq("organization_id", profile.organization_id!).select().single();
    if (error) return jsonError(error.message, 500);
    return NextResponse.json(data);
  }, "project_manager");
}
