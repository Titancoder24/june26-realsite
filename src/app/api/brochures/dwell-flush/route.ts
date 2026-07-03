import { NextResponse } from "next/server";
import { z } from "zod";
import type { BrochureDwellFlushPayload } from "@/types/brochure-intelligence";
import { jsonError } from "@/lib/api-utils";
import { brochureService } from "@/services/brochure.service";

const schema = z.object({
  sessionId: z.string().uuid(),
  brochureId: z.string().uuid(),
  pageDwell: z.array(z.any()).optional(),
  sectionDwell: z.array(z.any()).optional(),
  scrollDepth: z.array(z.any()).optional(),
  heatmapPoints: z.array(z.any()).optional(),
  events: z.array(z.any()).optional(),
  ended: z.boolean().optional(),
});

export async function POST(req: Request) {
  try {
    const body = schema.parse(await req.json()) as BrochureDwellFlushPayload;
    const result = await brochureService.flushDwell(body);
    return NextResponse.json(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Flush failed";
    return jsonError(message, 400);
  }
}
