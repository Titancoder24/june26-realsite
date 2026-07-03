import { NextResponse } from "next/server";
import { withAuth } from "@/lib/api-utils";
import { salesTrainingService } from "@/services/sales-training.service";

export async function GET() {
  return withAuth(async (profile) => {
    const overview = await salesTrainingService.overview(profile);
    return NextResponse.json(overview);
  }, "sales_agent");
}
