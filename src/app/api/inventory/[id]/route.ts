import { NextResponse } from "next/server";
import { z } from "zod";
import { inventoryService } from "@/services/inventory.service";
import { withAuth, jsonError } from "@/lib/api-utils";

const patchSchema = z.object({
  toStatus: z.enum(["available", "on_hold", "booked", "sold", "blocked"]),
  reason: z.string().optional(),
  leadId: z.string().uuid().optional(),
  holdHours: z.number().int().positive().optional(),
  priceCurrent: z.number().optional(),
});

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return withAuth(async (profile) => {
    try {
      const history = await inventoryService.getHistory(id, profile.organization_id!);
      return NextResponse.json(history);
    } catch (err) {
      return jsonError(err instanceof Error ? err.message : "Failed to load history", 500);
    }
  }, "sales_agent");
}

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return withAuth(async (profile) => {
    try {
      const body = patchSchema.parse(await req.json());
      const updated = await inventoryService.changeStatus({
        propertyId: id,
        organizationId: profile.organization_id!,
        changedBy: profile.id,
        toStatus: body.toStatus,
        reason: body.reason,
        leadId: body.leadId,
        holdHours: body.holdHours,
        priceCurrent: body.priceCurrent,
      });
      return NextResponse.json(updated);
    } catch (err) {
      return jsonError(err instanceof Error ? err.message : "Failed to update inventory", 500);
    }
  }, "sales_manager");
}
