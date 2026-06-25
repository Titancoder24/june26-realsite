import { NextResponse } from "next/server";
import { z } from "zod";
import { aiService } from "@/services/ai.service";
import { withAuth, jsonError } from "@/lib/api-utils";

const schema = z.object({
  propertyId: z.string().uuid(),
  query: z.string().min(1),
});

export async function POST(req: Request) {
  return withAuth(async (profile) => {
    if (!profile.organization_id) return jsonError("No organization", 400);
    const body = schema.parse(await req.json());
    const response = await aiService.answer({
      organizationId: profile.organization_id,
      propertyId: body.propertyId,
      query: body.query,
    });
    return NextResponse.json(response);
  }, "project_manager");
}
