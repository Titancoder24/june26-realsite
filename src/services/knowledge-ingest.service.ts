import { createAdminClient } from "@/lib/supabase/admin";
import { extractAttachmentText } from "@/lib/pdf-extract";
import {
  mergeStructuredPropertyKnowledge,
  parseStructuredPropertyKnowledgeFromExtraction,
} from "@/lib/property-knowledge";
import {
  loadStructuredPropertyKnowledge,
  saveStructuredPropertyKnowledge,
} from "@/services/property-knowledge.service";
import { walkthroughPlannerService } from "@/services/walkthrough-planner.service";
import { refreshWalkthroughChecklist, saveRagEntriesFromChat } from "@/services/walkthrough.service";

export type KnowledgeIngestAttachment = {
  name: string;
  mime?: string;
  text?: string;
  data_base64?: string;
};

export type KnowledgeIngestResult = {
  reply: string;
  structured_knowledge: Awaited<ReturnType<typeof saveStructuredPropertyKnowledge>>;
  entries_saved: number;
  session_id?: string;
  extracted_chars: number;
};

async function resolveExperienceId(propertyId: string, organizationId: string): Promise<string | null> {
  const admin = createAdminClient();
  const { data: primary } = await admin
    .from("experiences")
    .select("id")
    .eq("property_id", propertyId)
    .eq("organization_id", organizationId)
    .eq("primary_experience", true)
    .limit(1)
    .maybeSingle();

  if (primary?.id) return primary.id;

  const { data: anyExp } = await admin
    .from("experiences")
    .select("id")
    .eq("property_id", propertyId)
    .eq("organization_id", organizationId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  return anyExp?.id ?? null;
}

export async function ingestPropertyKnowledge(params: {
  propertyId: string;
  organizationId: string;
  userId: string;
  message: string;
  attachments?: KnowledgeIngestAttachment[];
  experienceId?: string;
  sessionId?: string;
  persistSession?: boolean;
}): Promise<KnowledgeIngestResult> {
  const admin = createAdminClient();
  const experienceId =
    params.experienceId ?? (await resolveExperienceId(params.propertyId, params.organizationId));

  const attachmentBlocks: string[] = [];
  for (const attachment of params.attachments ?? []) {
    const text = await extractAttachmentText(attachment);
    if (text) {
      attachmentBlocks.push(`--- ${attachment.name} ---\n${text}`);
    }
  }

  const attachmentText = attachmentBlocks.join("\n\n");
  const fullMessage = attachmentText
    ? `${params.message.trim() || "Please extract property knowledge from the attached document(s)."}\n\nAttached content:\n${attachmentText}`
    : params.message.trim();

  if (!fullMessage) {
    throw new Error("Message or attachment content is required.");
  }

  let sessionId = params.sessionId;
  if (params.persistSession !== false && experienceId) {
    if (!sessionId) {
      const { data: session } = await admin.from("walkthrough_rag_sessions").insert({
        experience_id: experienceId,
        property_id: params.propertyId,
        organization_id: params.organizationId,
        created_by: params.userId,
      }).select().single();
      sessionId = session?.id;
    }

    if (sessionId) {
      await admin.from("walkthrough_rag_messages").insert({
        session_id: sessionId,
        role: "user",
        content: fullMessage,
        attachments: params.attachments ?? [],
      });
    }
  }

  const { data: history } = sessionId
    ? await admin
        .from("walkthrough_rag_messages")
        .select("role, content")
        .eq("session_id", sessionId)
        .order("created_at")
        .limit(20)
    : { data: [] as { role: string; content: string }[] };

  const { reply, structured, entries } = await walkthroughPlannerService.extractRagFromChat(
    fullMessage,
    (history ?? []).slice(0, -1).map((m) => ({ role: m.role, content: m.content })),
  );

  const extracted = parseStructuredPropertyKnowledgeFromExtraction(structured, structured);
  const existing = await loadStructuredPropertyKnowledge(params.propertyId);
  const merged = mergeStructuredPropertyKnowledge(existing, extracted);
  const structuredKnowledge = await saveStructuredPropertyKnowledge(
    params.propertyId,
    params.organizationId,
    merged,
    params.userId,
  );

  const legacySaved = await saveRagEntriesFromChat(
    params.propertyId,
    params.organizationId,
    entries,
    params.userId,
  );

  if (sessionId) {
    await admin.from("walkthrough_rag_messages").insert({
      session_id: sessionId,
      role: "assistant",
      content: reply,
      extracted_entries: { structured_knowledge: structuredKnowledge, legacy_entries: legacySaved },
    });
  }

  if (experienceId) {
    await refreshWalkthroughChecklist(experienceId);
  }

  return {
    reply,
    structured_knowledge: structuredKnowledge,
    entries_saved: legacySaved.length,
    session_id: sessionId,
    extracted_chars: fullMessage.length,
  };
}
