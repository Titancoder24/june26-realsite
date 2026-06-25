import { NextResponse } from "next/server";
import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";
import { withAuth, jsonError } from "@/lib/api-utils";
import { refreshImageWalkthroughChecklist } from "@/services/image-walkthrough.service";

const schema = z.object({
  experience_id: z.string().uuid(),
  node_id: z.string().uuid(),
  x_position: z.number().min(0).max(1),
  y_position: z.number().min(0).max(1),
  title: z.string().min(1),
  description: z.string().optional(),
  category: z.string().optional(),
  icon_type: z.string().optional(),
  ai_context: z.string().optional(),
});

export async function POST(req: Request) {
  return withAuth(async () => {
    const body = schema.parse(await req.json());
    const admin = createAdminClient();
    const { data, error } = await admin.from("image_walkthrough_annotations").insert({
      ...body,
      ai_suggested: false,
    }).select().single();
    if (error) return jsonError(error.message, 500);
    await refreshImageWalkthroughChecklist(body.experience_id);
    return NextResponse.json(data, { status: 201 });
  }, "project_manager");
}

export async function PATCH(req: Request) {
  return withAuth(async () => {
    const body = schema.partial().extend({ id: z.string().uuid(), experience_id: z.string().uuid() }).parse(await req.json());
    const admin = createAdminClient();
    const { id, experience_id, ...patch } = body;
    const { data, error } = await admin.from("image_walkthrough_annotations").update({
      ...patch,
      updated_at: new Date().toISOString(),
    }).eq("id", id).select().single();
    if (error) return jsonError(error.message, 500);
    await refreshImageWalkthroughChecklist(experience_id);
    return NextResponse.json(data);
  }, "project_manager");
}

export async function DELETE(req: Request) {
  return withAuth(async () => {
    const id = new URL(req.url).searchParams.get("id");
    const experienceId = new URL(req.url).searchParams.get("experienceId");
    if (!id || !experienceId) return jsonError("id and experienceId required", 400);
    const admin = createAdminClient();
    await admin.from("image_walkthrough_annotations").delete().eq("id", id);
    await refreshImageWalkthroughChecklist(experienceId);
    return NextResponse.json({ ok: true });
  }, "project_manager");
}
