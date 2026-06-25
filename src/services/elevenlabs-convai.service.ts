import { env, requireServerKey } from "@/lib/env";
import { structuredKnowledgeToPromptSummary } from "@/lib/property-knowledge";
import {
  type ElevenLabsConvaiConfig,
  type ElevenLabsConvaiSessionBundle,
} from "@/lib/elevenlabs-convai";
import {
  ELEVENLABS_AUTO_LANGUAGE,
  toElevenLabsAgentLanguage,
} from "@/lib/elevenlabs-languages";
import {
  parseElevenLabsStudioVoiceConfig,
  resolveStudioVoiceId,
} from "@/lib/elevenlabs-studio-voice";
import type { WalkthroughNavScene } from "@/lib/walkthrough-inference/fast-navigation";
import { createAdminClient } from "@/lib/supabase/admin";
import { loadStructuredPropertyKnowledge } from "@/services/property-knowledge.service";
import { ragService } from "@/services/rag.service";
import { getElevenLabsClient } from "@/services/elevenlabs.service";
import { elevenLabsConvaiProvisionService } from "@/services/elevenlabs-convai-provision.service";
import { buildWalkthroughFirstMessage } from "@/lib/walkthrough-voice-greeting";

export type ElevenLabsConvaiSessionParams = {
  organizationId: string;
  propertyId: string;
  experienceId: string;
  sessionId?: string;
  propertyName: string;
  projectName?: string;
  speechLanguageCode: string;
  activeSceneId?: string;
  scenes: WalkthroughNavScene[];
  convai: ElevenLabsConvaiConfig;
  viewerConfig?: Record<string, unknown> | null;
  skipGreeting?: boolean;
};

export class ElevenLabsConvaiService {
  isConfigured(): boolean {
    return Boolean(env.server.ELEVENLABS_API_KEY?.trim());
  }

  async resolveAgentId(config?: ElevenLabsConvaiConfig): Promise<string> {
    if (config?.agent_id?.trim()) return config.agent_id.trim();
    const fromEnv = env.server.ELEVENLABS_AGENT_ID?.trim();
    if (fromEnv) return fromEnv;

    const provisioned = await elevenLabsConvaiProvisionService.findWalkthroughAgentId();
    if (provisioned) return provisioned;

    const created = await elevenLabsConvaiProvisionService.provisionWalkthroughAgent();
    return created.agentId;
  }

  async buildSessionBundle(params: ElevenLabsConvaiSessionParams): Promise<ElevenLabsConvaiSessionBundle> {
    const agentId = await this.resolveAgentId(params.convai);
    const client = getElevenLabsClient();

    const tokenResponse = await client.conversationalAi.conversations.getWebrtcToken({
      agentId,
      participantName: params.sessionId ?? `walkthrough-${params.experienceId}`,
      branchId: params.convai.branch_id,
      environment: params.convai.environment,
    });

    const structured = await loadStructuredPropertyKnowledge(params.propertyId);
    const knowledgeSummary = structured
      ? structuredKnowledgeToPromptSummary(structured)
      : "No structured property knowledge yet. Use general tour guidance only.";

    const sceneList = params.scenes.map((s) => s.title).filter(Boolean).join(", ");
    const activeScene = params.scenes.find((s) => s.id === params.activeSceneId);

    const appUrl = env.NEXT_PUBLIC_APP_URL.replace(/\/$/, "");
    const toolSecret = env.server.ELEVENLABS_CONVAI_TOOL_SECRET;
    const studioVoice = parseElevenLabsStudioVoiceConfig(params.viewerConfig);
    const speechCode =
      params.speechLanguageCode === ELEVENLABS_AUTO_LANGUAGE
        ? studioVoice.language
        : params.speechLanguageCode || studioVoice.language;
    const speechVoiceId = resolveStudioVoiceId(studioVoice, speechCode);
    const greeting = buildWalkthroughFirstMessage(
      params.propertyName,
      params.projectName,
      speechCode,
    );

    const hotwords = [
      params.propertyName,
      ...params.scenes.map((s) => s.title).filter(Boolean),
      params.projectName ?? "",
    ].filter(Boolean);

    return {
      conversationToken: tokenResponse.token,
      connectionType: "webrtc",
      agentId,
      dynamicVariables: {
        organization_id: params.organizationId,
        property_id: params.propertyId,
        experience_id: params.experienceId,
        session_id: params.sessionId ?? `walkthrough-${params.experienceId}`,
        property_name: params.propertyName,
        project_name: params.projectName ?? "",
        active_scene_id: params.activeSceneId ?? "",
        active_scene_title: activeScene?.title ?? "",
        scenes_list: sceneList,
        knowledge_summary: knowledgeSummary,
        rag_tool_url: `${appUrl}/api/walkthrough/elevenlabs/rag`,
        stt_model: env.server.ELEVENLABS_STT_MODEL,
        ...(toolSecret ? { tool_secret: toolSecret } : {}),
      },
      overrides: {
        agent: {
          firstMessage: params.skipGreeting ? "" : greeting,
          language: toElevenLabsAgentLanguage(speechCode),
        },
        asr: {
          keywords: hotwords.slice(0, 40),
        },
        tts: {
          voiceId: speechVoiceId,
          stability: studioVoice.stability,
          similarityBoost: studioVoice.similarity_boost,
          speed: studioVoice.speed,
        },
      },
      ragToolUrl: `${appUrl}/api/walkthrough/elevenlabs/rag`,
    };
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

    return contexts.map((c, i) => `[${i + 1}] ${c.title}: ${c.content}`).join("\n");
  }

  validateToolSecret(secret?: string): boolean {
    const expected = env.server.ELEVENLABS_CONVAI_TOOL_SECRET;
    if (!expected) return true;
    return secret === expected;
  }
}

export const elevenLabsConvaiService = new ElevenLabsConvaiService();

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
