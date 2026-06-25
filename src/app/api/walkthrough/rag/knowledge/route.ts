import { NextResponse } from "next/server";
import { z } from "zod";
import { withAuth, jsonError } from "@/lib/api-utils";
import { normalizeStructuredPropertyKnowledge } from "@/lib/property-knowledge";
import {
  loadStructuredPropertyKnowledge,
  saveStructuredPropertyKnowledge,
} from "@/services/property-knowledge.service";
import { refreshWalkthroughChecklist } from "@/services/walkthrough.service";

export async function GET(req: Request) {
  return withAuth(async () => {
    const propertyId = new URL(req.url).searchParams.get("propertyId");
    if (!propertyId) return jsonError("propertyId required", 400);

    const knowledge = await loadStructuredPropertyKnowledge(propertyId);
    return NextResponse.json({ structured_knowledge: knowledge });
  }, "project_manager");
}

const patchSchema = z.object({
  property_id: z.string().uuid(),
  experience_id: z.string().uuid().optional(),
  structured_knowledge: z.record(z.unknown()),
});

export async function PATCH(req: Request) {
  return withAuth(async (profile) => {
    if (!profile.organization_id) return jsonError("No organization", 400);

    const body = patchSchema.parse(await req.json());
    const normalized = normalizeStructuredPropertyKnowledge(body.structured_knowledge);

    const saved = await saveStructuredPropertyKnowledge(
      body.property_id,
      profile.organization_id,
      normalized,
      profile.id,
    );

    if (body.experience_id) {
      await refreshWalkthroughChecklist(body.experience_id);
    }

    return NextResponse.json({ structured_knowledge: saved });
  }, "project_manager");
}
