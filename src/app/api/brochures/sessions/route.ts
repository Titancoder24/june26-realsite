import { NextResponse } from "next/server";
import { z } from "zod";
import { jsonError } from "@/lib/api-utils";
import { brochureService } from "@/services/brochure.service";

const optionalUuid = z.preprocess((value) => {
  if (typeof value !== "string" || value.trim() === "") return undefined;
  return z.string().uuid().safeParse(value).success ? value : undefined;
}, z.string().uuid().optional());

const schema = z.object({
  brochureId: z.string().uuid(),
  leadId: z.string().uuid().optional(),
  consentReceiptId: z.string().uuid().optional(),
  utmSource: z.string().optional(),
  utmMedium: z.string().optional(),
  utmCampaign: z.string().optional(),
  utmContent: z.string().optional(),
  utmTerm: z.string().optional(),
  agentId: optionalUuid,
  screenWidth: z.number().optional(),
  screenHeight: z.number().optional(),
  language: z.string().optional(),
  timezone: z.string().optional(),
});

export async function POST(req: Request) {
  try {
    const body = schema.parse(await req.json());
    const session = await brochureService.createPublicSession({
      brochureId: body.brochureId,
      leadId: body.leadId,
      consentReceiptId: body.consentReceiptId,
      agentId: body.agentId,
      screenWidth: body.screenWidth,
      screenHeight: body.screenHeight,
      language: body.language,
      timezone: body.timezone,
      userAgent: req.headers.get("user-agent") ?? "",
      utm: {
        utm_source: body.utmSource,
        utm_medium: body.utmMedium,
        utm_campaign: body.utmCampaign,
        utm_content: body.utmContent,
        utm_term: body.utmTerm,
      },
    });
    return NextResponse.json({ session });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Session creation failed";
    return jsonError(message, 400);
  }
}
