import { NextResponse } from "next/server";
import { z } from "zod";
import { withAuth, jsonError } from "@/lib/api-utils";
import { walkthroughPlannerService } from "@/services/walkthrough-planner.service";

const bodySchema = z.object({
  text: z.string().min(3),
  sceneTitle: z.string().min(1),
});

export async function POST(req: Request) {
  return withAuth(async () => {
    const body = bodySchema.parse(await req.json());
    try {
      const suggestion = await walkthroughPlannerService.suggestAnnotationFromText(body.text, body.sceneTitle);
      return NextResponse.json(suggestion);
    } catch (e) {
      return jsonError(e instanceof Error ? e.message : "Annotation suggestion failed", 500);
    }
  }, "project_manager");
}
