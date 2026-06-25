import { NextResponse } from "next/server";
import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";
import { withAuth, jsonError } from "@/lib/api-utils";

export async function GET() {
  return withAuth(async (profile) => {
    const admin = createAdminClient();
    const { data, error } = await admin
      .from("profiles")
      .select("id, full_name, email, role")
      .eq("organization_id", profile.organization_id!);
    if (error) return jsonError(error.message, 500);
    return NextResponse.json(data);
  }, "sales_agent");
}

const patchSchema = z.object({
  agentId: z.string().uuid(),
  role: z.enum([
    "viewer",
    "sales_agent",
    "marketing_manager",
    "sales_manager",
    "project_manager",
    "organization_admin",
    "platform_admin",
  ]),
});

export async function PATCH(req: Request) {
  return withAuth(async (profile) => {
    const body = patchSchema.parse(await req.json());
    if (body.role === "platform_admin") return jsonError("Cannot assign platform_admin via team API", 403);

    const admin = createAdminClient();
    const { data: target } = await admin
      .from("profiles")
      .select("organization_id")
      .eq("id", body.agentId)
      .single();

    if (!target || target.organization_id !== profile.organization_id) {
      return jsonError("Agent not found", 404);
    }

    const { error } = await admin.from("profiles").update({ role: body.role }).eq("id", body.agentId);
    if (error) return jsonError(error.message, 500);
    return NextResponse.json({ ok: true });
  }, "organization_admin");
}
