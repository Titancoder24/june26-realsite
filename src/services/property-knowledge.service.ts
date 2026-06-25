import { createAdminClient } from "@/lib/supabase/admin";
import {
  attachEntryIdsToStructuredKnowledge,
  createEmptyStructuredPropertyKnowledge,
  normalizeStructuredPropertyKnowledge,
  structuredKnowledgeHasContent,
  structuredKnowledgeToRagDrafts,
} from "@/lib/property-knowledge";
import type { PropertyKnowledgeSectionKey, StructuredPropertyKnowledge } from "@/types/property-knowledge";
import { embeddingService } from "./embedding.service";

const SOURCE_TYPE = "walkthrough_structured_knowledge";

function setSingleSectionValue(
  knowledge: StructuredPropertyKnowledge,
  key: PropertyKnowledgeSectionKey,
  value: string,
) {
  const trimmed = value.trim();
  if (!trimmed) return;
  const section = knowledge.sections.find((s) => s.key === key);
  if (!section || section.value?.trim()) return;
  section.value = trimmed;
  section.confidence = 1;
}

export async function seedPropertyKnowledgeFromProperty(
  propertyId: string,
  organizationId: string,
  createdBy?: string,
): Promise<StructuredPropertyKnowledge | null> {
  const existing = await loadStructuredPropertyKnowledge(propertyId);
  if (existing && structuredKnowledgeHasContent(existing)) return existing;

  const admin = createAdminClient();
  const { data: property } = await admin
    .from("properties")
    .select("name, property_type, city, locality, address")
    .eq("id", propertyId)
    .single();

  const knowledge = existing ?? createEmptyStructuredPropertyKnowledge();
  setSingleSectionValue(knowledge, "property_name", property?.name ?? "");
  setSingleSectionValue(knowledge, "property_type", property?.property_type ?? "");
  const locationParts = [property?.locality, property?.city, property?.address].filter(Boolean);
  setSingleSectionValue(knowledge, "location", locationParts.join(", "));
  if (property?.name) {
    setSingleSectionValue(knowledge, "overview", `${property.name} — interactive property walkthrough`);
  }

  if (!structuredKnowledgeHasContent(knowledge)) return existing;

  return await saveStructuredPropertyKnowledge(propertyId, organizationId, knowledge, createdBy);
}

export async function loadStructuredPropertyKnowledge(propertyId: string): Promise<StructuredPropertyKnowledge | null> {
  const admin = createAdminClient();
  const { data } = await admin.from("properties").select("metadata").eq("id", propertyId).single();
  const metadata = (data?.metadata ?? {}) as Record<string, unknown>;
  const raw = metadata.structured_property_knowledge;
  if (!raw) return null;
  return normalizeStructuredPropertyKnowledge(raw);
}

export async function saveStructuredPropertyKnowledge(
  propertyId: string,
  organizationId: string,
  knowledge: StructuredPropertyKnowledge,
  createdBy?: string,
): Promise<StructuredPropertyKnowledge> {
  const admin = createAdminClient();
  const normalized = normalizeStructuredPropertyKnowledge(knowledge);
  const synced = await syncStructuredKnowledgeToRag(propertyId, organizationId, normalized, createdBy);

  const { data: property } = await admin.from("properties").select("metadata").eq("id", propertyId).single();
  const metadata = (property?.metadata ?? {}) as Record<string, unknown>;

  await admin.from("properties").update({
    metadata: {
      ...metadata,
      structured_property_knowledge: synced,
    },
    updated_at: new Date().toISOString(),
  }).eq("id", propertyId);

  return synced;
}

async function syncStructuredKnowledgeToRag(
  propertyId: string,
  organizationId: string,
  knowledge: StructuredPropertyKnowledge,
  createdBy?: string,
): Promise<StructuredPropertyKnowledge> {
  const admin = createAdminClient();
  const drafts = structuredKnowledgeToRagDrafts(knowledge);
  const entryMap = new Map<string, string>();
  const activeEntryIds = new Set<string>();

  for (const draft of drafts) {
    const mapKey = `${draft.sectionKey}:${draft.fieldId}`;
    const payload = {
      property_id: propertyId,
      organization_id: organizationId,
      category: draft.category,
      title: draft.title,
      content: draft.content,
      approved: true,
      source_type: SOURCE_TYPE,
      created_by: createdBy,
      updated_at: new Date().toISOString(),
    };

    if (draft.entryId) {
      const { data } = await admin
        .from("knowledge_entries")
        .update(payload)
        .eq("id", draft.entryId)
        .eq("property_id", propertyId)
        .select()
        .single();

      if (data) {
        entryMap.set(mapKey, data.id);
        activeEntryIds.add(data.id);
        const embedding = await embeddingService.embed(`${data.title}\n${data.content}`);
        await admin.from("knowledge_embeddings").upsert(
          { knowledge_entry_id: data.id, embedding },
          { onConflict: "knowledge_entry_id" },
        );
        continue;
      }
    }

    const { data: created } = await admin.from("knowledge_entries").insert(payload).select().single();
    if (!created) continue;

    entryMap.set(mapKey, created.id);
    activeEntryIds.add(created.id);
    const embedding = await embeddingService.embed(`${created.title}\n${created.content}`);
    await admin.from("knowledge_embeddings").upsert(
      { knowledge_entry_id: created.id, embedding },
      { onConflict: "knowledge_entry_id" },
    );
  }

  const { data: staleEntries } = await admin
    .from("knowledge_entries")
    .select("id")
    .eq("property_id", propertyId)
    .eq("source_type", SOURCE_TYPE);

  const staleIds = (staleEntries ?? [])
    .map((e) => e.id)
    .filter((id) => !activeEntryIds.has(id));

  if (staleIds.length) {
    await admin.from("knowledge_entries").delete().in("id", staleIds);
  }

  return attachEntryIdsToStructuredKnowledge(
    { ...knowledge, updated_at: new Date().toISOString() },
    entryMap,
  );
}
