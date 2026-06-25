import { NextResponse } from "next/server";
import { inventoryService } from "@/services/inventory.service";

export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (secret && req.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const result = await inventoryService.releaseExpiredHolds();
  return NextResponse.json(result);
}
