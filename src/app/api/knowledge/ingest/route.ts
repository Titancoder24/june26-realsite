import { NextResponse } from "next/server";
import { z } from "zod";
import { withAuth, jsonError } from "@/lib/api-utils";
import { ingestPropertyKnowledge } from "@/services/knowledge-ingest.service";

export const runtime = "nodejs";

const attachmentSchema = z.object({
  name: z.string().min(1),
  mime: z.string().optional(),
  text: z.string().optional(),
  data_base64: z.string().optional(),
});

const schema = z.object({
  property_id: z.string().uuid(),
  experience_id: z.string().uuid().optional(),
  session_id: z.string().uuid().optional(),
  message: z.string().default(""),
  attachments: z.array(attachmentSchema).optional(),
});

/** ChatGPT-style property knowledge ingestion — text, PDF, or documents. */
export async function POST(req: Request) {
  return withAuth(async (profile) => {
    if (!profile.organization_id) return jsonError("No organization", 400);

    const body = schema.parse(await req.json());

    if (!body.message.trim() && !(body.attachments?.length)) {
      return jsonError("Add a message or upload a file.", 400);
    }

    try {
      const result = await ingestPropertyKnowledge({
        propertyId: body.property_id,
        organizationId: profile.organization_id,
        userId: profile.id,
        message: body.message,
        attachments: body.attachments,
        experienceId: body.experience_id,
        sessionId: body.session_id,
      });

      return NextResponse.json({
        ...result,
        status: "ready_for_voice_agent",
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Knowledge ingestion failed";
      return jsonError(message, 500);
    }
  }, "project_manager");
}
