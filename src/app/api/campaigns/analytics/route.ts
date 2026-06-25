import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { withAuth } from "@/lib/api-utils";

export async function GET() {
  return withAuth(async (profile) => {
    const admin = createAdminClient();
    const { data: campaigns } = await admin
      .from("campaign_links")
      .select("id, utm_campaign, utm_source, utm_medium, property_id, properties(name)")
      .eq("organization_id", profile.organization_id!);

    const results = await Promise.all((campaigns ?? []).map(async (c) => {
      const [{ count: sessions }, { count: leads }, { data: hot }] = await Promise.all([
        admin.from("buyer_sessions").select("*", { count: "exact", head: true }).eq("property_id", c.property_id).eq("utm_campaign", c.utm_campaign),
        admin.from("leads").select("*", { count: "exact", head: true }).eq("property_id", c.property_id).eq("campaign", c.utm_campaign),
        admin.from("leads").select("id").eq("property_id", c.property_id).eq("campaign", c.utm_campaign).gte("intent_score", 80),
      ]);
      return { ...c, sessions: sessions ?? 0, leads: leads ?? 0, hotLeads: hot?.length ?? 0 };
    }));

    return NextResponse.json(results);
  }, "marketing_manager");
}
