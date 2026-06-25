import { NextResponse } from "next/server";
import { z } from "zod";
import { withAuth, jsonError } from "@/lib/api-utils";
import { planAndCreateScenes } from "@/services/walkthrough.service";

export const maxDuration = 180;

const schema = z.object({ experience_id: z.string().uuid() });

export async function POST(req: Request) {
  return withAuth(async () => {
    const body = schema.parse(await req.json());
    try {
      const result = await planAndCreateScenes(body.experience_id);
      return NextResponse.json(result);
    } catch (err) {
      return jsonError(err instanceof Error ? err.message : "Planning failed", 500);
    }
  }, "project_manager");
}
