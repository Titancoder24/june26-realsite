import { NextResponse } from "next/server";
import { z } from "zod";
import { withAuth, jsonError } from "@/lib/api-utils";
import { captureService } from "@/services/capture.service";

const initSchema = z.object({
  experience_id: z.string().uuid(),
  property_id: z.string().uuid(),
  template: z.enum(["residential", "office", "rental"]),
  custom_rooms: z.array(z.string()).optional(),
});

export async function GET(req: Request) {
  return withAuth(async () => {
    const experienceId = new URL(req.url).searchParams.get("experienceId");
    if (!experienceId) return jsonError("experienceId required");
    const rooms = await captureService.listRooms(experienceId);
    return NextResponse.json(rooms);
  });
}

export async function POST(req: Request) {
  return withAuth(async (profile) => {
    if (!profile.organization_id) return jsonError("No organization", 400);
    const body = initSchema.parse(await req.json());
    const rooms = await captureService.initRooms({
      experienceId: body.experience_id,
      propertyId: body.property_id,
      organizationId: profile.organization_id,
      template: body.template,
      customRooms: body.custom_rooms,
    });
    return NextResponse.json(rooms, { status: 201 });
  }, "project_manager");
}
