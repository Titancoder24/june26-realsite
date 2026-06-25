import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { withAuth, jsonError } from "@/lib/api-utils";
import { ensureWalkthroughChecklist, refreshWalkthroughChecklist } from "@/services/walkthrough.service";

export async function GET(_req: Request, { params }: { params: Promise<{ experienceId: string }> }) {
  return withAuth(async () => {
    const { experienceId } = await params;
    await ensureWalkthroughChecklist(experienceId);
    const checklist = await refreshWalkthroughChecklist(experienceId);
    const admin = createAdminClient();
    const { data: warnings } = await admin.from("walkthrough_checklists").select("warnings").eq("experience_id", experienceId).single();
    return NextResponse.json({
      ...checklist,
      experience_id: experienceId,
      warnings: warnings?.warnings ?? checklist.warnings ?? [],
    });
  });
}

export async function PATCH(req: Request, { params }: { params: Promise<{ experienceId: string }> }) {
  return withAuth(async () => {
    const { experienceId } = await params;
    const body = await req.json();
    const admin = createAdminClient();
    const { data, error } = await admin.from("walkthrough_checklists").upsert({
      experience_id: experienceId,
      ...body,
      updated_at: new Date().toISOString(),
    }, { onConflict: "experience_id" }).select().single();
    if (error) return jsonError(error.message, 500);
    return NextResponse.json(data);
  }, "project_manager");
}
