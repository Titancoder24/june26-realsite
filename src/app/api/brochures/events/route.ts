import { NextResponse } from "next/server";
import { z } from "zod";
import { jsonError } from "@/lib/api-utils";
import { brochureService } from "@/services/brochure.service";
import type { BrochureTrackingEvent } from "@/types/brochure-intelligence";

const eventSchema = z.object({
  eventType: z.string(),
  pageNumber: z.number().optional(),
  sectionId: z.string().optional(),
  x: z.number().min(0).max(1).optional(),
  y: z.number().min(0).max(1).optional(),
  payload: z.record(z.string(), z.unknown()).optional(),
});

const schema = z.object({
  sessionId: z.string().uuid(),
  brochureId: z.string().uuid(),
  events: z.array(eventSchema).min(1),
});

export async function POST(req: Request) {
  try {
    const body = schema.parse(await req.json());
    const result = await brochureService.recordSessionEvents({
      sessionId: body.sessionId,
      brochureId: body.brochureId,
      events: body.events as BrochureTrackingEvent[],
    });
    return NextResponse.json(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Event capture failed";
    return jsonError(message, 400);
  }
}
