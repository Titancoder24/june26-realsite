import { NextResponse } from "next/server";
import { z } from "zod";
import { withAuth, jsonError } from "@/lib/api-utils";
import { stitchService } from "@/services/stitch.service";

const schema = z.object({
  stitched_image_url: z.string().url().optional(),
  panorama_config: z.object({
    type: z.literal("equirectangular").optional(),
    haov: z.number().optional(),
    vaov: z.number().optional(),
    vOffset: z.number().optional(),
    hfov: z.number().optional(),
  }).optional(),
  initial_yaw: z.number().optional(),
  initial_pitch: z.number().optional(),
  extracted_frame_count: z.number().int().positive().optional(),
});

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  return withAuth(async () => {
    const { id } = await params;
    const body = schema.parse(await req.json().catch(() => ({})));
    try {
      const result = await stitchService.processRoom(id, {
        stitchedImageUrl: body.stitched_image_url,
        panoramaConfig: body.panorama_config,
        initialYaw: body.initial_yaw,
        initialPitch: body.initial_pitch,
        extractedFrameCount: body.extracted_frame_count,
      });
      return NextResponse.json(result);
    } catch (e) {
      return jsonError(e instanceof Error ? e.message : "Stitch failed", 500);
    }
  }, "project_manager");
}
