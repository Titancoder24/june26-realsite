import { NextResponse } from "next/server";
import { refreshImageWalkthroughChecklist } from "@/services/image-walkthrough.service";
import { withAuth } from "@/lib/api-utils";

export async function GET(_req: Request, { params }: { params: Promise<{ experienceId: string }> }) {
  const { experienceId } = await params;
  return withAuth(async () => {
    const checklist = await refreshImageWalkthroughChecklist(experienceId);
    return NextResponse.json(checklist);
  }, "project_manager");
}

export async function PATCH(req: Request, { params }: { params: Promise<{ experienceId: string }> }) {
  const { experienceId } = await params;
  return withAuth(async () => {
    const body = await req.json() as { preview_checked?: boolean };
    if (body.preview_checked) {
      const admin = (await import("@/lib/supabase/admin")).createAdminClient();
      await admin.from("image_walkthrough_checklists").update({
        preview_checked: true,
        updated_at: new Date().toISOString(),
      }).eq("experience_id", experienceId);
    }
    const checklist = await refreshImageWalkthroughChecklist(experienceId);
    return NextResponse.json(checklist);
  }, "project_manager");
}
