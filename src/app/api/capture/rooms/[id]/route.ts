import { NextResponse } from "next/server";
import { z } from "zod";
import { withAuth, jsonError } from "@/lib/api-utils";
import { captureService } from "@/services/capture.service";

const patchSchema = z.object({
  room_name: z.string().min(1).optional(),
  notes: z.string().optional(),
  status: z.enum(["not_started", "capturing", "processing", "needs_retake", "complete"]).optional(),
});

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  return withAuth(async () => {
    const { id } = await params;
    const body = patchSchema.parse(await req.json());
    const room = await captureService.updateRoom(id, body);
    return NextResponse.json(room);
  }, "project_manager");
}
