import { createAdminClient } from "@/lib/supabase/admin";
import { withAuth } from "@/lib/api-utils";

export async function GET() {
  return withAuth(async (profile) => {
    const admin = createAdminClient();
    const { data } = await admin
      .from("leads")
      .select("name, phone, email, source, campaign, intent_score, lead_status, created_at, properties(name)")
      .eq("organization_id", profile.organization_id!)
      .order("intent_score", { ascending: false });

    const header = "name,phone,email,source,campaign,intent_score,status,property,created_at\n";
    const rows = (data ?? []).map((l) => {
      const prop = l.properties as { name?: string } | null;
      return [
        l.name ?? "", l.phone ?? "", l.email ?? "", l.source ?? "", l.campaign ?? "",
        l.intent_score ?? 0, l.lead_status ?? "", prop?.name ?? "", l.created_at ?? "",
      ].map((v) => `"${String(v).replace(/"/g, '""')}"`).join(",");
    }).join("\n");

    return new Response(header + rows, {
      headers: {
        "Content-Type": "text/csv",
        "Content-Disposition": `attachment; filename="leads-${Date.now()}.csv"`,
      },
    });
  }, "sales_manager");
}
