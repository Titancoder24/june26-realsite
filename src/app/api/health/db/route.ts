import { NextResponse } from "next/server";
import { checkDatabaseHealth } from "@/lib/supabase/health";

export async function GET() {
  const health = await checkDatabaseHealth();
  return NextResponse.json(health, { status: health.connected ? 200 : 503 });
}
