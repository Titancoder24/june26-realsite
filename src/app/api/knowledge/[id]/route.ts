import { NextResponse } from "next/server";
import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";
import { withAuth, jsonError } from "@/lib/api-utils";
import { embeddingService } from "@/services/embedding.service";

const schema = z.object({
  category: z.string().optional(),
  title: z.string().optional(),
  content: z.string().optional(),
  approved: z.boolean().optional(),
});

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return withAuth(async (profile) => {
    const body = schema.parse(await req.json());
    const admin = createAdminClient();
    const { data, error } = await admin.from("knowledge_entries").update({ ...body, updated_at: new Date().toISOString() }).eq("id", id).eq("organization_id", profile.organization_id!).select().single();
    if (error) return jsonError(error.message, 500);

    if (body.content || body.title) {
      const embedding = await embeddingService.embed(`${data.title}\n${data.content}`);
      await admin.from("knowledge_embeddings").upsert({ knowledge_entry_id: id, embedding }, { onConflict: "knowledge_entry_id" });
    }
    return NextResponse.json(data);
  }, "project_manager");
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return withAuth(async (profile) => {
    const admin = createAdminClient();
    const { error } = await admin.from("knowledge_entries").delete().eq("id", id).eq("organization_id", profile.organization_id!);
    if (error) return jsonError(error.message, 500);
    return NextResponse.json({ ok: true });
  }, "project_manager");
}
