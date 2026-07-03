import { NextResponse } from "next/server";
import { z } from "zod";
import { jsonError } from "@/lib/api-utils";
import { parseDeviceFromUserAgent } from "@/lib/brochure-device";
import { brochureService } from "@/services/brochure.service";

const optionalUuid = z.preprocess((value) => {
  if (typeof value !== "string" || value.trim() === "") return undefined;
  return z.string().uuid().safeParse(value).success ? value : undefined;
}, z.string().uuid().optional());

const schema = z.object({
  brochureId: z.string().uuid(),
  name: z.string().min(1),
  phone: z.string().min(6),
  email: z.string().email().optional().or(z.literal("")),
  consent: z.literal(true),
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
    const ua = req.headers.get("user-agent") ?? "";
    const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "";

    const device = parseDeviceFromUserAgent(
      ua,
      body.screenWidth ?? 0,
      body.screenHeight ?? 0,
      body.language ?? "en",
      body.timezone ?? "UTC",
    );

    const result = await brochureService.captureLead({
      brochureId: body.brochureId,
      name: body.name,
      phone: body.phone,
      email: body.email || undefined,
      consent: body.consent,
      userAgent: ua,
      ip,
      agentId: body.agentId,
      device,
      utm: {
        utm_source: body.utmSource,
        utm_medium: body.utmMedium,
        utm_campaign: body.utmCampaign,
        utm_content: body.utmContent,
        utm_term: body.utmTerm,
      },
    });

    return NextResponse.json(result);
  } catch (err) {
    const message =
      err instanceof Error
        ? err.message
        : typeof err === "object" && err && "message" in err && typeof err.message === "string"
          ? err.message
          : "Lead capture failed";
    return jsonError(message, 400);
  }
}
