import { NextResponse } from "next/server";
import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";
import { withAuth, jsonError } from "@/lib/api-utils";
import { embeddingService } from "@/services/embedding.service";

const schema = z.object({
  title: z.string().optional(),
  description: z.string().optional(),
  checkpoint_type: z.string().optional(),
  position: z.record(z.unknown()).optional(),
  ai_context: z.string().optional(),
  cta_type: z.string().optional(),
  cta_label: z.string().optional(),
  visibility: z.string().optional(),
});

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return withAuth(async (profile) => {
    const body = schema.parse(await req.json());
    const admin = createAdminClient();
    const { data, error } = await admin.from("checkpoints").update(body).eq("id", id).select().single();
    if (error) return jsonError(error.message, 500);

    if (profile.organization_id && data) {
      const content = data.ai_context || data.description || data.title;
      const { data: entry } = await admin.from("knowledge_entries").select("id").eq("source_id", id).maybeSingle();
      if (entry) {
        await admin.from("knowledge_entries").update({ content, title: data.title, updated_at: new Date().toISOString() }).eq("id", entry.id);
        const embedding = await embeddingService.embed(content);
        await admin.from("knowledge_embeddings").upsert({ knowledge_entry_id: entry.id, embedding }, { onConflict: "knowledge_entry_id" });
      }
    }
    return NextResponse.json(data);
  }, "project_manager");
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return withAuth(async () => {
    const admin = createAdminClient();
    await admin.from("knowledge_entries").delete().eq("source_id", id).eq("source_type", "checkpoint");
    const { error } = await admin.from("checkpoints").delete().eq("id", id);
    if (error) return jsonError(error.message, 500);
    return NextResponse.json({ ok: true });
  }, "project_manager");
}
