import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { withAuth, jsonError } from "@/lib/api-utils";

export async function GET(req: Request) {
  return withAuth(async () => {
    const url = new URL(req.url);
    const limit = Number(url.searchParams.get("limit") ?? 50);
    const admin = createAdminClient();
    const { data, error } = await admin
      .from("admin_audit_logs")
      .select("*, profiles(full_name, email)")
      .order("created_at", { ascending: false })
      .limit(limit);
    if (error) return jsonError(error.message, 500);
    return NextResponse.json(data);
  }, "platform_admin");
}
