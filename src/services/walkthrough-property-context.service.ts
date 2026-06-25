import { createAdminClient } from "@/lib/supabase/admin";
import {
  structuredKnowledgeHasContent,
  structuredKnowledgeToPromptSummary,
} from "@/lib/property-knowledge";
import { loadStructuredPropertyKnowledge } from "@/services/property-knowledge.service";
import type { KnowledgeCategory, RAGContext } from "@/types/domain";

export type PropertyVoiceBundle = {
  propertyId: string;
  experienceId: string;
  structuredSummary: string;
  contexts: RAGContext[];
  loadedAt: number;
};

const bundleCache = new Map<string, PropertyVoiceBundle>();
const CACHE_TTL_MS = 5 * 60 * 1000;

function cacheKey(propertyId: string, experienceId: string) {
  return `${propertyId}:${experienceId}`;
}

function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((t) => t.length > 2);
}

function keywordScore(text: string, terms: string[]): number {
  if (!terms.length) return 0.1;
  const hay = text.toLowerCase();
  let hits = 0;
  for (const term of terms) {
    if (hay.includes(term)) hits += 1;
  }
  return hits / terms.length;
}

function rankContexts(contexts: RAGContext[], query: string, limit: number): RAGContext[] {
  const terms = tokenize(query);
  const ranked = contexts
    .map((ctx) => ({
      ...ctx,
      score: Math.max(ctx.score, keywordScore(`${ctx.title} ${ctx.content} ${ctx.category}`, terms)),
    }))
    .sort((a, b) => b.score - a.score);

  if (!terms.length) return ranked.slice(0, limit);
  const matched = ranked.filter((c) => c.score >= 0.15);
  return (matched.length ? matched : ranked).slice(0, limit);
}

/** Try to answer from FAQ / high-confidence entries without calling the LLM. */
export function tryInstantKnowledgeAnswer(contexts: RAGContext[], query: string): string | null {
  const q = query.toLowerCase().trim();
  if (!q || q.length < 3) return null;

  for (const ctx of contexts) {
    const content = ctx.content.trim();
    if (!content) continue;

    if (ctx.category === "faq" || content.includes("FAQ —")) {
      const faqMatch = content.match(/FAQ\s*[—-]\s*(.+?):\s*(.+)/i);
      if (faqMatch) {
        const question = faqMatch[1].toLowerCase();
        const answer = faqMatch[2].trim();
        if (question && answer && (q.includes(question.slice(0, 12)) || question.includes(q.slice(0, 12)))) {
          return answer;
        }
      }
    }

    if (ctx.title && q.includes(ctx.title.toLowerCase().slice(0, 16)) && content.length < 320) {
      return content;
    }
  }

  return null;
}

async function loadSceneContexts(experienceId: string, sceneId?: string): Promise<RAGContext[]> {
  const admin = createAdminClient();
  const results: RAGContext[] = [];

  const { data: scenes } = await admin
    .from("walkthrough_scenes")
    .select("id, title, room_type, description, caption, ai_context, scene_order")
    .eq("experience_id", experienceId)
    .neq("scene_status", "excluded")
    .order("scene_order");

  for (const scene of scenes ?? []) {
    const content = [scene.ai_context, scene.description, scene.caption, scene.room_type]
      .filter(Boolean)
      .join(". ");
    if (!content) continue;
    results.push({
      id: scene.id,
      category: "room_context" as KnowledgeCategory,
      title: scene.title,
      content,
      sourceType: "walkthrough_scene",
      sourceId: scene.id,
      score: scene.id === sceneId ? 0.98 : 0.72,
    });
  }

  if (sceneId) {
    const { data: wtScene } = await admin
      .from("walkthrough_scenes")
      .select("id, title, ai_context, description, caption")
      .eq("id", sceneId)
      .maybeSingle();

    if (wtScene) {
      const content = wtScene.ai_context || wtScene.description || wtScene.caption;
      if (content) {
        results.unshift({
          id: wtScene.id,
          category: "room_context",
          title: wtScene.title,
          content,
          sourceType: "walkthrough_scene",
          sourceId: wtScene.id,
          score: 0.99,
        });
      }

      const { data: anns } = await admin
        .from("walkthrough_annotations")
        .select("id, title, description, short_description, ai_context")
        .eq("scene_id", sceneId)
        .eq("visibility", "public")
        .limit(8);

      for (const ann of anns ?? []) {
        const annContent = [ann.title, ann.short_description, ann.description, ann.ai_context]
          .filter(Boolean)
          .join(". ");
        if (!annContent) continue;
        results.unshift({
          id: ann.id,
          category: "room_context",
          title: ann.title,
          content: annContent,
          sourceType: "walkthrough_annotation",
          sourceId: ann.id,
          score: 0.88,
        });
      }
    }
  }

  return results;
}

export async function loadPropertyVoiceBundle(params: {
  organizationId: string;
  propertyId: string;
  experienceId: string;
  sceneId?: string;
}): Promise<PropertyVoiceBundle> {
  const key = cacheKey(params.propertyId, params.experienceId);
  const cached = bundleCache.get(key);
  if (cached && Date.now() - cached.loadedAt < CACHE_TTL_MS) {
    const ranked = rankContexts(cached.contexts, "", 24);
    if (params.sceneId) {
      const sceneContexts = await loadSceneContexts(params.experienceId, params.sceneId);
      return {
        ...cached,
        contexts: rankContexts([...sceneContexts, ...cached.contexts], "", 24),
      };
    }
    return { ...cached, contexts: ranked };
  }

  const admin = createAdminClient();
  const contexts: RAGContext[] = [];

  const [structured, entriesResult, sceneContexts, propertyRow] = await Promise.all([
    loadStructuredPropertyKnowledge(params.propertyId),
    admin
      .from("knowledge_entries")
      .select("id, category, title, content, source_type, source_id")
      .eq("organization_id", params.organizationId)
      .eq("property_id", params.propertyId)
      .eq("approved", true)
      .order("updated_at", { ascending: false })
      .limit(40),
    loadSceneContexts(params.experienceId, params.sceneId),
    admin.from("properties").select("name, property_type, city, locality, address").eq("id", params.propertyId).maybeSingle(),
  ]);

  let structuredSummary = "";
  if (structured && structuredKnowledgeHasContent(structured)) {
    structuredSummary = structuredKnowledgeToPromptSummary(structured, 5000);
    contexts.push({
      id: `structured-${params.propertyId}`,
      category: "project_details",
      title: "Approved property knowledge",
      content: structuredSummary,
      sourceType: "structured_knowledge",
      sourceId: params.propertyId,
      score: 0.92,
    });
  }

  if (propertyRow.data?.name) {
    const location = [propertyRow.data.locality, propertyRow.data.city, propertyRow.data.address]
      .filter(Boolean)
      .join(", ");
    contexts.push({
      id: `property-meta-${params.propertyId}`,
      category: "project_details",
      title: propertyRow.data.name,
      content: [
        propertyRow.data.name,
        propertyRow.data.property_type,
        location ? `Location: ${location}` : "",
      ]
        .filter(Boolean)
        .join(". "),
      sourceType: "property",
      sourceId: params.propertyId,
      score: 0.8,
    });
  }

  for (const [i, entry] of (entriesResult.data ?? []).entries()) {
    contexts.push({
      id: entry.id,
      category: entry.category as KnowledgeCategory,
      title: entry.title,
      content: entry.content,
      sourceType: entry.source_type,
      sourceId: entry.source_id ?? undefined,
      score: 0.78 - i * 0.01,
    });
  }

  contexts.push(...sceneContexts);

  const bundle: PropertyVoiceBundle = {
    propertyId: params.propertyId,
    experienceId: params.experienceId,
    structuredSummary,
    contexts,
    loadedAt: Date.now(),
  };

  bundleCache.set(key, bundle);
  return bundle;
}

export async function retrieveVoicePropertyContext(params: {
  organizationId: string;
  propertyId: string;
  experienceId: string;
  query: string;
  sceneId?: string;
  limit?: number;
}): Promise<RAGContext[]> {
  const bundle = await loadPropertyVoiceBundle(params);
  return rankContexts(bundle.contexts, params.query, params.limit ?? 10);
}

export function warmPropertyVoiceBundle(params: {
  organizationId: string;
  propertyId: string;
  experienceId: string;
}) {
  void loadPropertyVoiceBundle(params).catch(() => {});
}
