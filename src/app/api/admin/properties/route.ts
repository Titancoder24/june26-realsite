import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { withAuth, jsonError } from "@/lib/api-utils";

export async function GET() {
  return withAuth(async () => {
    const admin = createAdminClient();
    const { data, error } = await admin
      .from("properties")
      .select("id, name, organization_id, projects(name)")
      .order("name");

    if (error) return jsonError(error.message, 500);
    return NextResponse.json(data ?? []);
  }, "platform_admin");
}
