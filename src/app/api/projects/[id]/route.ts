import { NextResponse } from "next/server";
import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";
import { withAuth, jsonError } from "@/lib/api-utils";

const schema = z.object({
  name: z.string().optional(),
  project_type: z.string().optional(),
  city: z.string().optional(),
  locality: z.string().optional(),
  address: z.string().optional(),
  rera_number: z.string().optional(),
  possession_timeline: z.string().optional(),
  status: z.string().optional(),
});

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return withAuth(async (profile) => {
    const admin = createAdminClient();
    const { data, error } = await admin.from("projects").select("*").eq("id", id).eq("organization_id", profile.organization_id!).single();
    if (error) return jsonError("Not found", 404);
    return NextResponse.json(data);
  });
}

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return withAuth(async (profile) => {
    const body = schema.parse(await req.json());
    const admin = createAdminClient();
    const { data, error } = await admin.from("projects").update({ ...body, updated_at: new Date().toISOString() }).eq("id", id).eq("organization_id", profile.organization_id!).select().single();
    if (error) return jsonError(error.message, 500);
    return NextResponse.json(data);
  }, "project_manager");
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return withAuth(async (profile) => {
    const admin = createAdminClient();
    const { error } = await admin.from("projects").delete().eq("id", id).eq("organization_id", profile.organization_id!);
    if (error) return jsonError(error.message, 500);
    return NextResponse.json({ ok: true });
  }, "organization_admin");
}
