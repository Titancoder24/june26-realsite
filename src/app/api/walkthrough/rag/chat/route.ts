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
  url: z.string().optional(),
});

const schema = z.object({
  experience_id: z.string().uuid(),
  property_id: z.string().uuid(),
  session_id: z.string().uuid().optional(),
  message: z.string().min(1),
  attachments: z.array(attachmentSchema).optional(),
});

export async function POST(req: Request) {
  return withAuth(async (profile) => {
    if (!profile.organization_id) return jsonError("No organization", 400);
    const body = schema.parse(await req.json());

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
        session_id: result.session_id,
        reply: result.reply,
        entries_saved: result.entries_saved,
        structured_knowledge: result.structured_knowledge,
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Chat extraction failed";
      return jsonError(message, 500);
    }
  }, "project_manager");
}
