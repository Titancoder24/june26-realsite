import { NextResponse } from "next/server";
import { inventoryService } from "@/services/inventory.service";
import { withAuth, jsonError } from "@/lib/api-utils";

export async function GET(req: Request) {
  return withAuth(async (profile) => {
    const url = new URL(req.url);
    const projectId = url.searchParams.get("projectId") ?? undefined;
    const status = url.searchParams.get("status") ?? undefined;
    try {
      const properties = await inventoryService.listInventory(profile.organization_id!, { projectId, status });
      const summary = inventoryService.summarize(properties ?? []);
      return NextResponse.json({ properties, summary });
    } catch (err) {
      return jsonError(err instanceof Error ? err.message : "Failed to load inventory", 500);
    }
  });
}
