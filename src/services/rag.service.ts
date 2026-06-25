import { createAdminClient } from "@/lib/supabase/admin";
import { embeddingService } from "./embedding.service";
import type { KnowledgeCategory, RAGContext } from "@/types/domain";

export class RAGService {
  async retrieve(params: {
    organizationId: string;
    propertyId: string;
    query: string;
    sceneId?: string;
    checkpointId?: string;
    limit?: number;
  }): Promise<RAGContext[]> {
    const supabase = createAdminClient();
    const limit = params.limit ?? 8;
    const results: RAGContext[] = [];

    try {
      const embedding = await embeddingService.embed(params.query);
      const { data: vectorResults } = await supabase.rpc("match_knowledge", {
        query_embedding: embedding,
        match_threshold: 0.5,
        match_count: limit,
        p_organization_id: params.organizationId,
        p_property_id: params.propertyId,
      });

      if (vectorResults?.length) {
        results.push(...vectorResults.map((e: { id: string; category: string; title: string; content: string; source_type: string; source_id?: string; similarity: number }) => ({
          id: e.id,
          category: e.category as KnowledgeCategory,
          title: e.title,
          content: e.content,
          sourceType: e.source_type,
          sourceId: e.source_id ?? undefined,
          score: e.similarity,
        })));
      }
    } catch {
      // fall through to text search
    }

    if (!results.length) {
      const { data: entries } = await supabase
        .from("knowledge_entries")
        .select("id, category, title, content, source_type, source_id")
        .eq("organization_id", params.organizationId)
        .eq("property_id", params.propertyId)
        .eq("approved", true)
        .or(`content.ilike.%${params.query.split(" ")[0]}%,title.ilike.%${params.query.split(" ")[0]}%`)
        .limit(limit);

      results.push(...(entries ?? []).map((e, i) => ({
        id: e.id,
        category: e.category as KnowledgeCategory,
        title: e.title,
        content: e.content,
        sourceType: e.source_type,
        sourceId: e.source_id ?? undefined,
        score: 0.75 - i * 0.05,
      })));
    }

    if (params.checkpointId) {
      const { data: cp } = await supabase.from("checkpoints").select("id, title, description, ai_context").eq("id", params.checkpointId).single();
      if (cp?.ai_context || cp?.description) {
        results.unshift({
          id: cp.id,
          category: "checkpoint_context",
          title: cp.title,
          content: cp.ai_context || cp.description || "",
          sourceType: "checkpoint",
          sourceId: cp.id,
          score: 0.95,
        });
      }
    }

    if (params.sceneId) {
      const { data: scene360 } = await supabase.from("tour_360_scenes").select("id, room_name, ai_context").eq("id", params.sceneId).single();
      if (scene360?.ai_context) {
        results.unshift({
          id: scene360.id,
          category: "room_context",
          title: scene360.room_name,
          content: scene360.ai_context,
          sourceType: "scene",
          sourceId: scene360.id,
          score: 0.9,
        });
      }

      const { data: wtScene } = await supabase.from("walkthrough_scenes").select("id, title, ai_context, description, caption").eq("id", params.sceneId).single();
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
            score: 0.93,
          });
        }

        const { data: wtAnns } = await supabase
          .from("walkthrough_annotations")
          .select("id, title, description, short_description, ai_context")
          .eq("scene_id", params.sceneId)
          .eq("visibility", "public")
          .eq("rag_enabled", true)
          .limit(5);

        for (const ann of wtAnns ?? []) {
          const annContent = [ann.title, ann.short_description, ann.description, ann.ai_context].filter(Boolean).join(". ");
          if (annContent) {
            results.unshift({
              id: ann.id,
              category: "room_context",
              title: ann.title,
              content: annContent,
              sourceType: "walkthrough_annotation",
              sourceId: ann.id,
              score: 0.89,
            });
          }
        }
      }

      const { data: propScene } = await supabase.from("property_scenes").select("id, title, ai_context, description").eq("id", params.sceneId).single();
      if (propScene) {
        const content = propScene.ai_context || propScene.description;
        if (content) {
          results.unshift({
            id: propScene.id,
            category: "room_context",
            title: propScene.title,
            content,
            sourceType: "property_scene",
            sourceId: propScene.id,
            score: 0.92,
          });
        }

        const { data: anns } = await supabase
          .from("scene_annotations")
          .select("id, title, description, short_description, ai_context")
          .eq("scene_id", params.sceneId)
          .eq("visibility", "public")
          .eq("rag_enabled", true)
          .limit(5);

        for (const ann of anns ?? []) {
          const annContent = [ann.title, ann.short_description, ann.description, ann.ai_context].filter(Boolean).join(". ");
          if (annContent) {
            results.unshift({
              id: ann.id,
              category: "room_context",
              title: ann.title,
              content: annContent,
              sourceType: "scene_annotation",
              sourceId: ann.id,
              score: 0.88,
            });
          }
        }
      }
    }

    return results.slice(0, limit);
  }

  async getReadinessScore(propertyId: string) {
    const supabase = createAdminClient();
    const critical: KnowledgeCategory[] = [
      "project_details", "unit_details", "pricing", "availability",
      "amenities", "possession", "legal", "rera", "faq",
    ];

    const { data } = await supabase.from("knowledge_entries").select("category").eq("property_id", propertyId).eq("approved", true);
    const present = new Set((data ?? []).map((d) => d.category));
    const categories = critical.map((cat) => ({
      category: cat,
      status: present.has(cat) ? "complete" as const : "missing" as const,
    }));
    const complete = categories.filter((c) => c.status === "complete").length;
    return { categories, overall: Math.round((complete / critical.length) * 100) };
  }
}

export const ragService = new RAGService();
