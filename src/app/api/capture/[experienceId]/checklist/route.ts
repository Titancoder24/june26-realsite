import { NextResponse } from "next/server";
import { withAuth, jsonError } from "@/lib/api-utils";
import { captureService } from "@/services/capture.service";

export async function GET(_req: Request, { params }: { params: Promise<{ experienceId: string }> }) {
  return withAuth(async () => {
    const { experienceId } = await params;
    const checklist = await captureService.getPublishChecklist(experienceId);
    return NextResponse.json(checklist);
  });
}
