import { NextResponse } from "next/server";
import { withAuth } from "@/lib/api-utils";
import { getPlatformAdminStats } from "@/services/admin-analytics.service";

export async function GET() {
  return withAuth(async () => {
    const stats = await getPlatformAdminStats();
    return NextResponse.json(stats);
  }, "platform_admin");
}
