import { createAdminClient } from "@/lib/supabase/admin";
import { embeddingService } from "./embedding.service";

export async function syncSceneToRAG(
  scene: { id: string; property_id: string; title: string; description?: string | null; ai_context?: string | null },
  organizationId: string,
) {
  const admin = createAdminClient();
  const content = scene.ai_context || scene.description || `Scene: ${scene.title}`;
  const { data: existing } = await admin
    .from("knowledge_entries")
    .select("id")
    .eq("source_id", scene.id)
    .eq("source_type", "property_scene")
    .maybeSingle();

  const entry = {
    organization_id: organizationId,
    property_id: scene.property_id,
    scene_id: scene.id,
    category: "room_context",
    title: scene.title,
    content,
    source_type: "property_scene",
    source_id: scene.id,
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

export async function syncAnnotationToRAG(
  ann: {
    id: string;
    property_id: string;
    scene_id: string;
    title: string;
    description?: string | null;
    short_description?: string | null;
    ai_context?: string | null;
    category: string;
  },
  organizationId: string,
  sceneTitle: string,
) {
  const admin = createAdminClient();
  const content = [
    `Scene: ${sceneTitle}`,
    `Object: ${ann.title}`,
    ann.short_description,
    ann.description,
    ann.ai_context,
  ].filter(Boolean).join(". ");

  const { data: existing } = await admin
    .from("knowledge_entries")
    .select("id")
    .eq("source_id", ann.id)
    .eq("source_type", "scene_annotation")
    .maybeSingle();

  const entry = {
    organization_id: organizationId,
    property_id: ann.property_id,
    scene_id: ann.scene_id,
    annotation_id: ann.id,
    category: "room_context",
    title: ann.title,
    content,
    source_type: "scene_annotation",
    source_id: ann.id,
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
  await admin.from("scene_annotations").update({ rag_entry_id: entryId }).eq("id", ann.id);
  return entryId;
}
