import { NextResponse } from "next/server";
import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";
import { withAuth, jsonError } from "@/lib/api-utils";

const schema = z.object({
  branding: z.record(z.unknown()).optional(),
  white_label_config: z.record(z.unknown()).optional(),
  custom_domain: z.string().optional(),
});

export async function GET() {
  return withAuth(async (profile) => {
    if (!profile.organization_id) return jsonError("No organization", 400);
    const admin = createAdminClient();
    const { data, error } = await admin.from("organizations").select("name, branding, white_label_config, custom_domain").eq("id", profile.organization_id).single();
    if (error) return jsonError(error.message, 500);
    return NextResponse.json(data);
  });
}

export async function PATCH(req: Request) {
  return withAuth(async (profile) => {
    if (!profile.organization_id) return jsonError("No organization", 400);
    const body = schema.parse(await req.json());
    const admin = createAdminClient();
    const { data, error } = await admin.from("organizations").update({ ...body, updated_at: new Date().toISOString() }).eq("id", profile.organization_id).select().single();
    if (error) return jsonError(error.message, 500);
    return NextResponse.json(data);
  }, "organization_admin");
}
