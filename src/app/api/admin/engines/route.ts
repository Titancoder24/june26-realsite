import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { withAuth } from "@/lib/api-utils";

export async function GET() {
  return withAuth(async () => {
    const admin = createAdminClient();
    const { data } = await admin.from("organizations").select("id, name, settings");
    return NextResponse.json({
      globalDefault: "worldlabs_splat",
      organizations: data?.map((o) => ({
        id: o.id,
        name: o.name,
        engine: (o.settings as { default_engine?: string })?.default_engine ?? "360_realistic",
      })),
    });
  }, "platform_admin");
}

export async function PATCH(req: Request) {
  return withAuth(async (profile) => {
    const { organizationId, defaultEngine, reason } = await req.json();
    const admin = createAdminClient();
    const { data: org } = await admin.from("organizations").select("settings").eq("id", organizationId).single();
    const settings = { ...(org?.settings as object ?? {}), default_engine: defaultEngine };

    await admin.from("organizations").update({ settings }).eq("id", organizationId);
    await admin.from("admin_audit_logs").insert({
      actor_id: profile.id,
      organization_id: organizationId,
      action: "engine_switch",
      target_type: "organization",
      target_id: organizationId,
      reason,
      payload: { defaultEngine },
    });

    return NextResponse.json({ ok: true });
  }, "platform_admin");
}
