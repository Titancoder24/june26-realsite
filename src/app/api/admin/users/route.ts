import { NextResponse } from "next/server";
import { withAuth } from "@/lib/api-utils";
import { getPlatformUsers } from "@/services/admin-analytics.service";

export async function GET(req: Request) {
  return withAuth(async () => {
    const { searchParams } = new URL(req.url);
    const limit = Math.min(200, Math.max(1, Number(searchParams.get("limit") ?? 100)));
    const users = await getPlatformUsers(limit);
    return NextResponse.json({ users, total: users.length });
  }, "platform_admin");
}
