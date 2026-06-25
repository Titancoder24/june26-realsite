import { NextResponse } from "next/server";
import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";
import { withAuth, jsonError } from "@/lib/api-utils";
import { isPlatformAdmin } from "@/lib/auth/platform-scope";

const schema = z.object({
  status: z.string().optional(),
  primary_experience: z.boolean().optional(),
  viewer_config: z.record(z.unknown()).optional(),
});

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return withAuth(async (profile) => {
    const admin = createAdminClient();
    let query = admin
      .from("experiences")
      .select("*, properties(*), tour_360_scenes(*), splat_worlds(*), floor_maps(*), checkpoints(*)")
      .eq("id", id);
    if (!isPlatformAdmin(profile)) {
      query = query.eq("organization_id", profile.organization_id!);
    }
    const { data, error } = await query.single();
    if (error) return jsonError("Not found", 404);
    return NextResponse.json(data);
  });
}

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return withAuth(async (profile) => {
    const body = schema.parse(await req.json());
    const admin = createAdminClient();
    let query = admin
      .from("experiences")
      .update({ ...body, updated_at: new Date().toISOString() })
      .eq("id", id);
    if (!isPlatformAdmin(profile)) {
      query = query.eq("organization_id", profile.organization_id!);
    }
    const { data, error } = await query.select().single();
    if (error) return jsonError(error.message, 500);
    return NextResponse.json(data);
  }, "project_manager");
}
