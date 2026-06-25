import { NextResponse } from "next/server";
import { warmPropertyVoiceBundle } from "@/services/walkthrough-property-context.service";

/** Preload property knowledge bundle so the first voice question is fast. */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const organizationId = url.searchParams.get("organizationId");
  const propertyId = url.searchParams.get("propertyId");
  const experienceId = url.searchParams.get("experienceId");

  if (!organizationId || !propertyId || !experienceId) {
    return NextResponse.json({ error: "organizationId, propertyId, experienceId required" }, { status: 400 });
  }

  warmPropertyVoiceBundle({ organizationId, propertyId, experienceId });
  return NextResponse.json({ ok: true });
}
