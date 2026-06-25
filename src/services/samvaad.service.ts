import { env, requireServerKey } from "@/lib/env";
import { structuredKnowledgeToPromptSummary } from "@/lib/property-knowledge";
import {
  type SamvaadAppConfig,
  type SamvaadSessionBundle,
  type SamvaadSessionParams,
  SAMVAAD_PROXY_API_KEY,
  samvaadRuntimeProxyBaseUrl,
  sarvamCodeToSamvaadLanguage,
} from "@/lib/sarvam-samvaad";
import type { WalkthroughNavScene } from "@/lib/walkthrough-inference/fast-navigation";
import { createAdminClient } from "@/lib/supabase/admin";
import { loadStructuredPropertyKnowledge } from "@/services/property-knowledge.service";
import { ragService } from "@/services/rag.service";
import { buildWalkthroughFirstMessage } from "@/lib/walkthrough-voice-greeting";

const SAMVAAD_RUNTIME_BASE = env.server.SARVAM_SAMVAAD_RUNTIME_BASE.replace(/\/$/, "");

export class SamvaadService {
  isApiConfigured(): boolean {
    return Boolean(env.server.SARVAM_API_KEY?.trim());
  }

  apiKey(): string {
    return requireServerKey("SARVAM_API_KEY", "Sarvam");
  }

  async buildSessionBundle(params: SamvaadSessionParams): Promise<SamvaadSessionBundle> {
    const structured = await loadStructuredPropertyKnowledge(params.propertyId);
    const knowledgeSummary = structured
      ? structuredKnowledgeToPromptSummary(structured)
      : "No structured property knowledge yet. Use general tour guidance only.";

    const sceneList = params.scenes
      .map((s) => s.title)
      .filter(Boolean)
      .join(", ");

    const activeScene = params.scenes.find((s) => s.id === params.activeSceneId);
    const unknownRules =
      structured?.sections.find((s) => s.key === "unknown_answer_rules")?.value?.trim() ??
      "If information is not in property knowledge, say you do not have that detail and offer to connect with sales.";

    const greeting = buildWalkthroughFirstMessage(
      params.propertyName,
      params.projectName,
      params.speechLanguageCode,
    );

    const hotwords = [
      params.propertyName,
      ...params.scenes.map((s) => s.title).filter(Boolean),
      params.projectName ?? "",
    ].filter(Boolean);

    const userIdentifier = params.sessionId ?? `walkthrough-${params.experienceId}`;

    return {
      apiKey: SAMVAAD_PROXY_API_KEY,
      baseUrl: samvaadRuntimeProxyBaseUrl(),
      config: {
        user_identifier_type: "custom",
        user_identifier: userIdentifier,
        org_id: params.samvaad.org_id,
        workspace_id: params.samvaad.workspace_id,
        app_id: params.samvaad.app_id,
        ...(params.samvaad.version != null ? { version: params.samvaad.version } : {}),
        interaction_type: "call",
        input_sample_rate: 16000,
        output_sample_rate: 16000,
        initial_language_name: sarvamCodeToSamvaadLanguage(params.speechLanguageCode),
        initial_bot_message: greeting,
        speech_hotwords: hotwords.slice(0, 40),
        agent_variables: {
          organization_id: params.organizationId,
          property_id: params.propertyId,
          experience_id: params.experienceId,
          session_id: userIdentifier,
          property_name: params.propertyName,
          project_name: params.projectName ?? "",
          active_scene_id: params.activeSceneId ?? "",
          active_scene_title: activeScene?.title ?? "",
          scenes_list: sceneList,
          knowledge_summary: knowledgeSummary,
          unknown_answer_rules: unknownRules,
          rag_tool_url: `${env.NEXT_PUBLIC_APP_URL.replace(/\/$/, "")}/api/walkthrough/samvaad/rag`,
        },
      },
    };
  }

  /** Proxy signed WebSocket URL fetch (same contract as sarvam-conv-ai-sdk). */
  async fetchSignedUrl(targetUrl: string): Promise<{ url: string; reference_id: string }> {
    const target = targetUrl.startsWith("http")
      ? targetUrl
      : `${SAMVAAD_RUNTIME_BASE}/${targetUrl.replace(/^\//, "")}`;
    const res = await fetch(target, {
      method: "GET",
      headers: {
        "X-API-Key": this.apiKey(),
      },
    });
    const text = await res.text();
    if (!res.ok) {
      throw new Error(text || `Samvaad signed URL failed (${res.status})`);
    }
    const data = JSON.parse(text) as { url?: string; reference_id?: string };
    if (!data.url || !data.reference_id) {
      throw new Error(`Invalid Samvaad signed URL response: ${text}`);
    }
    return { url: data.url, reference_id: data.reference_id };
  }

  async retrievePropertyContext(params: {
    organizationId: string;
    propertyId: string;
    query: string;
    activeSceneId?: string;
    limit?: number;
  }): Promise<string> {
    const contexts = await ragService.retrieve({
      organizationId: params.organizationId,
      propertyId: params.propertyId,
      query: params.query,
      sceneId: params.activeSceneId,
      limit: params.limit ?? 6,
    });

    if (!contexts.length) {
      return "No matching approved property knowledge was found for this question.";
    }

    return contexts
      .map((c, i) => `[${i + 1}] ${c.title}: ${c.content}`)
      .join("\n");
  }

  validateToolSecret(secret?: string): boolean {
    const expected = env.server.SARVAM_SAMVAAD_TOOL_SECRET;
    if (!expected) return true;
    return secret === expected;
  }
}

export const samvaadService = new SamvaadService();

/** Load walkthrough scene titles for Samvaad hotwords / navigation. */
export async function loadWalkthroughNavScenes(experienceId: string): Promise<WalkthroughNavScene[]> {
  const admin = createAdminClient();
  const { data } = await admin
    .from("walkthrough_scenes")
    .select("id, title, room_type, description, caption, ai_context")
    .eq("experience_id", experienceId)
    .order("scene_order");
  return (data ?? []).map((s) => ({
    id: s.id,
    title: s.title,
    room_type: s.room_type,
    description: s.description,
    caption: s.caption,
    ai_context: s.ai_context,
  }));
}
