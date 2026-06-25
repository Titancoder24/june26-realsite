import { NextResponse } from "next/server";
import { z } from "zod";
import { withAuth, jsonError } from "@/lib/api-utils";
import { captureService } from "@/services/capture.service";

const schema = z.object({
  angle_label: z.string().min(1),
  image_url: z.string().url(),
  media_asset_id: z.string().uuid().optional(),
  sort_order: z.number().optional(),
  metadata: z.record(z.unknown()).optional(),
});

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  return withAuth(async () => {
    const { id } = await params;
    const body = schema.parse(await req.json());
    const frame = await captureService.addFrame({
      captureRoomId: id,
      angleLabel: body.angle_label,
      imageUrl: body.image_url,
      mediaAssetId: body.media_asset_id,
      sortOrder: body.sort_order,
      metadata: body.metadata,
    });
    return NextResponse.json(frame, { status: 201 });
  }, "project_manager");
}
