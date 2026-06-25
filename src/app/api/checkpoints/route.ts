import { NextResponse } from "next/server";
import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";
import { withAuth, jsonError } from "@/lib/api-utils";
import { embeddingService } from "@/services/embedding.service";

const schema = z.object({
  experience_id: z.string().uuid(),
  property_id: z.string().uuid(),
  scene_id: z.string().uuid().optional(),
  title: z.string().min(1),
  description: z.string().optional(),
  checkpoint_type: z.string().default("info"),
  position: z.record(z.unknown()).optional(),
  ai_context: z.string().optional(),
  cta_type: z.string().optional(),
  cta_label: z.string().optional(),
  visibility: z.string().optional(),
});

async function syncCheckpointToRAG(admin: ReturnType<typeof createAdminClient>, cp: { id: string; property_id: string; title: string; description?: string | null; ai_context?: string | null }, organizationId: string) {
  const content = cp.ai_context || cp.description || cp.title;
  const { data: existing } = await admin.from("knowledge_entries").select("id").eq("source_id", cp.id).eq("source_type", "checkpoint").maybeSingle();

  const entry = {
    organization_id: organizationId,
    property_id: cp.property_id,
    category: "checkpoint_context",
    title: cp.title,
    content,
    source_type: "checkpoint",
    source_id: cp.id,
    approved: true,
  };

  let entryId: string;
  if (existing) {
    const { data } = await admin.from("knowledge_entries").update({ ...entry, updated_at: new Date().toISOString() }).eq("id", existing.id).select("id").single();
    entryId = data!.id;
  } else {
    const { data } = await admin.from("knowledge_entries").insert(entry).select("id").single();
    entryId = data!.id;
  }

  const embedding = await embeddingService.embed(content);
  await admin.from("knowledge_embeddings").upsert({ knowledge_entry_id: entryId, embedding }, { onConflict: "knowledge_entry_id" });
}

export async function GET(req: Request) {
  return withAuth(async () => {
    const experienceId = new URL(req.url).searchParams.get("experienceId");
    const admin = createAdminClient();
    let q = admin.from("checkpoints").select("*");
    if (experienceId) q = q.eq("experience_id", experienceId);
    const { data, error } = await q;
    if (error) return jsonError(error.message, 500);
    return NextResponse.json(data);
  });
}

export async function POST(req: Request) {
  return withAuth(async (profile) => {
    const body = schema.parse(await req.json());
    const admin = createAdminClient();
    const { data, error } = await admin.from("checkpoints").insert(body).select().single();
    if (error) return jsonError(error.message, 500);
    if (profile.organization_id) await syncCheckpointToRAG(admin, data, profile.organization_id);
    return NextResponse.json(data, { status: 201 });
  }, "project_manager");
}
