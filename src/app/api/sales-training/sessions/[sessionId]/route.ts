import { NextResponse } from "next/server";
import { withAuth } from "@/lib/api-utils";
import { salesTrainingService } from "@/services/sales-training.service";

export async function GET(_req: Request, { params }: { params: Promise<{ sessionId: string }> }) {
  const { sessionId } = await params;
  return withAuth(async (profile) => {
    const session = await salesTrainingService.getSession(profile, sessionId);
    return NextResponse.json(session);
  }, "sales_agent");
}
