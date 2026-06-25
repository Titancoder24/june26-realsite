import { env } from "@/lib/env";
import type { ElevenLabsStudioVoiceConfig } from "@/lib/elevenlabs-studio-voice";
import { studioVoiceElevenLabsLanguage } from "@/lib/elevenlabs-studio-voice";
import type { ConversationalConfig } from "@elevenlabs/elevenlabs-js/api/types";
import { AsrProvider, Llm, TtsConversationalModel } from "@elevenlabs/elevenlabs-js/api/types";
import { getElevenLabsClient } from "@/services/elevenlabs.service";

export const WALKTHROUGH_ELEVENLABS_AGENT_NAME = "Realsite Property Tour";
export const WALKTHROUGH_ELEVENLABS_AGENT_TAG = "realsite-walkthrough";
export const WALKTHROUGH_RAG_TOOL_NAME = "get_property_info";

import { WALKTHROUGH_VOICE_AGENT_PROMPT_TAIL } from "@/lib/walkthrough-voice-greeting";

const WALKTHROUGH_AGENT_PROMPT = `You are a playful, interactive voice tour guide for {{property_name}}.

${WALKTHROUGH_VOICE_AGENT_PROMPT_TAIL}`;

function ragToolUrl(): string {
  return `${env.NEXT_PUBLIC_APP_URL.replace(/\/$/, "")}/api/walkthrough/elevenlabs/rag`;
}

function describedStringProp(description: string) {
  return {
    type: "string" as const,
    description,
  };
}

/** ElevenLabs allows only one of description / dynamic_variable per property. */
function dynamicStringProp(dynamicVariable: string) {
  return {
    type: "string" as const,
    dynamicVariable,
  };
}

function buildRagWebhookToolConfig(): {
  type: "webhook";
  name: string;
  description: string;
  responseTimeoutSecs: number;
  executionMode: "immediate";
  apiSchema: {
    url: string;
    method: "POST";
    contentType: "application/json";
    requestBodySchema: {
      type: "object";
      required: string[];
      properties: Record<string, { type: "string"; description?: string; dynamicVariable?: string }>;
    };
  };
} {
  const toolSecret = env.server.ELEVENLABS_CONVAI_TOOL_SECRET;
  const bodyProperties: Record<string, { type: "string"; description?: string; dynamicVariable?: string }> = {
    organizationId: dynamicStringProp("organization_id"),
    propertyId: dynamicStringProp("property_id"),
    query: describedStringProp("Buyer question to search approved property knowledge"),
    activeSceneId: dynamicStringProp("active_scene_id"),
  };
  if (toolSecret) {
    bodyProperties.toolSecret = dynamicStringProp("tool_secret");
  }

  return {
    type: "webhook",
    name: WALKTHROUGH_RAG_TOOL_NAME,
    description:
      "Retrieve approved property knowledge (pricing, amenities, FAQs, legal) from the Realsite knowledge base.",
    responseTimeoutSecs: 20,
    executionMode: "immediate",
    apiSchema: {
      url: ragToolUrl(),
      method: "POST",
      contentType: "application/json",
      requestBodySchema: {
        type: "object",
        required: ["organizationId", "propertyId", "query"],
        properties: bodyProperties,
      },
    },
  };
}

function buildClientNavigationTools() {
  return [
    {
      type: "client" as const,
      name: "jump_to_scene",
      description: "Navigate the walkthrough to a scene/room when the buyer asks to see a space.",
      expectsResponse: true,
      parameters: {
        type: "object" as const,
        required: ["scene_name"],
        properties: {
          scene_name: describedStringProp("Room or scene name, e.g. kitchen, pool, master bedroom"),
        },
      },
    },
    {
      type: "client" as const,
      name: "pause_tour",
      description: "Pause the autoplay property tour when the buyer needs a break.",
      expectsResponse: true,
      parameters: {
        type: "object" as const,
        properties: {
          minutes: {
            type: "integer" as const,
            description: "How many minutes to pause (default 2)",
          },
        },
      },
    },
    {
      type: "client" as const,
      name: "resume_tour",
      description: "Resume the autoplay property tour.",
      expectsResponse: true,
    },
  ];
}

export class ElevenLabsConvaiProvisionService {
  async findWalkthroughAgentId(): Promise<string | null> {
    const client = getElevenLabsClient();
    const listed = await client.conversationalAi.agents.list({
      search: WALKTHROUGH_ELEVENLABS_AGENT_NAME,
      pageSize: 30,
    });
    const exact = listed.agents?.find(
      (a) => a.name === WALKTHROUGH_ELEVENLABS_AGENT_NAME || a.tags?.includes(WALKTHROUGH_ELEVENLABS_AGENT_TAG),
    );
    return exact?.agentId ?? listed.agents?.[0]?.agentId ?? null;
  }

  async findOrCreateRagToolId(): Promise<string> {
    const client = getElevenLabsClient();
    const tools = await client.conversationalAi.tools.list({
      search: WALKTHROUGH_RAG_TOOL_NAME,
      pageSize: 50,
      types: ["webhook"],
    });

    const existing = tools.tools?.find(
      (t) => t.toolConfig.type === "webhook" && t.toolConfig.name === WALKTHROUGH_RAG_TOOL_NAME,
    );

    const toolConfig = buildRagWebhookToolConfig();

    if (existing?.id) {
      await client.conversationalAi.tools.update(existing.id, { toolConfig });
      return existing.id;
    }

    const created = await client.conversationalAi.tools.create({
      toolConfig,
    });

    return created.id;
  }

  async provisionWalkthroughAgent(studioVoice?: ElevenLabsStudioVoiceConfig): Promise<{ agentId: string; created: boolean; ragToolId: string }> {
    const client = getElevenLabsClient();
    const ragToolId = await this.findOrCreateRagToolId();

    const existingId = await this.findWalkthroughAgentId();
    if (existingId) {
      await client.conversationalAi.agents.update(existingId, {
        conversationConfig: this.buildConversationConfig(studioVoice),
        name: WALKTHROUGH_ELEVENLABS_AGENT_NAME,
        tags: [WALKTHROUGH_ELEVENLABS_AGENT_TAG, "property-tour", "global-voice"],
      });
      return { agentId: existingId, created: false, ragToolId };
    }

    const created = await client.conversationalAi.agents.create({
      name: WALKTHROUGH_ELEVENLABS_AGENT_NAME,
      tags: [WALKTHROUGH_ELEVENLABS_AGENT_TAG, "property-tour", "global-voice"],
      conversationConfig: this.buildConversationConfig(studioVoice),
    });

    return { agentId: created.agentId, created: true, ragToolId };
  }

  async syncStudioVoiceConfig(studioVoice: ElevenLabsStudioVoiceConfig): Promise<string | null> {
    const agentId = await this.findWalkthroughAgentId();
    if (!agentId) return null;
    const client = getElevenLabsClient();
    const ragToolId = await this.findOrCreateRagToolId();
    await client.conversationalAi.agents.update(agentId, {
      conversationConfig: this.buildConversationConfig(studioVoice),
    });
    return agentId;
  }

  private buildConversationConfig(studioVoice?: ElevenLabsStudioVoiceConfig): ConversationalConfig {
    const voiceId = studioVoice?.voice_id ?? env.server.ELEVENLABS_VOICE_ID;
    const convaiModel = studioVoice?.convai_model ?? TtsConversationalModel.ElevenFlashV25;
    const agentLanguage = studioVoice ? studioVoiceElevenLabsLanguage(studioVoice) : "en";
    const toolSecret = env.server.ELEVENLABS_CONVAI_TOOL_SECRET;

    const dynamicVariablePlaceholders: Record<string, string> = {
      property_name: "Property",
      project_name: "",
      knowledge_summary: "",
      scenes_list: "",
      active_scene_title: "",
      organization_id: "",
      property_id: "",
      experience_id: "",
      active_scene_id: "",
      rag_tool_url: ragToolUrl(),
      stt_model: env.server.ELEVENLABS_STT_MODEL,
    };
    if (toolSecret) dynamicVariablePlaceholders.tool_secret = toolSecret;

    return {
      asr: {
        provider: AsrProvider.ScribeRealtime,
        quality: "high" as const,
        keywords: [],
      },
      tts: {
        modelId: convaiModel as TtsConversationalModel,
        voiceId,
      },
      turn: {
        turnTimeout: 7,
        silenceEndCallTimeout: 120,
      },
      agent: {
        language: agentLanguage,
        firstMessage: "",
        dynamicVariables: {
          dynamicVariablePlaceholders,
        },
        prompt: {
          prompt: WALKTHROUGH_AGENT_PROMPT,
          llm: Llm.Gpt4OMini,
          builtInTools: {
            languageDetection: {
              type: "system",
              name: "language_detection",
              description:
                "Detect which language the buyer is comfortable speaking (Hindi, Tamil, Telugu, Urdu, English, etc.) and switch accordingly.",
              params: { systemToolType: "language_detection" },
            },
          },
          tools: [buildRagWebhookToolConfig(), ...buildClientNavigationTools()],
          ignoreDefaultPersonality: false,
          timezone: "UTC",
        },
      },
    } as ConversationalConfig;
  }
}

export const elevenLabsConvaiProvisionService = new ElevenLabsConvaiProvisionService();
