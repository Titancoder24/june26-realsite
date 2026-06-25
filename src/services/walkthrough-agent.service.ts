import type { WalkthroughAICommand } from "@/lib/walkthrough-player-controller";
import {
  isResumeIntent,
  isWaitIntent,
  logVoiceNavigationDev,
  parseWaitDurationMs,
  resolveSceneNavigation,
} from "@/lib/walkthrough-inference/fast-navigation";
import { computeConfidence, shouldFallback } from "@/lib/grounded-ai";
import type { WalkthroughBrainProvider } from "@/lib/walkthrough-brain-provider";
import {
  WALKTHROUGH_SALES_AGENT_SYSTEM,
  WALKTHROUGH_VOICE_MAX_TOKENS,
} from "@/lib/walkthrough-sales-agent-prompt";
import {
  retrieveVoicePropertyContext,
  tryInstantKnowledgeAnswer,
} from "@/services/walkthrough-property-context.service";
import { walkthroughBrainChat } from "./walkthrough-brain.service";
import { createAdminClient } from "@/lib/supabase/admin";

export class WalkthroughAgentService {
  async resolveNavigation(
    query: string,
    experienceId: string,
  ): Promise<{
    sceneId?: string;
    annotationId?: string;
    label?: string;
    confidence?: number;
    clarifyMessage?: string;
  } | null> {
    const admin = createAdminClient();

    const { data: scenes } = await admin
      .from("walkthrough_scenes")
      .select("id, title, room_type, description, caption, ai_context")
      .eq("experience_id", experienceId)
      .order("scene_order");

    const navResult = resolveSceneNavigation(query, scenes ?? []);

    if (navResult.action === "navigate") {
      logVoiceNavigationDev({
        transcript: query,
        intent: "navigate",
        targetRoom: navResult.match.targetRoom,
        match: navResult.match,
        confidence: navResult.match.confidence,
        sceneId: navResult.match.sceneId,
        sceneTitle: navResult.match.label,
        success: true,
        action: "navigate",
      });
      return {
        sceneId: navResult.match.sceneId,
        label: navResult.match.label,
        confidence: navResult.match.confidence,
      };
    }

    if (navResult.action === "clarify") {
      logVoiceNavigationDev({
        transcript: query,
        intent: "navigate",
        targetRoom: navResult.candidates[0]?.targetRoom,
        match: navResult.candidates[0] ?? null,
        confidence: navResult.candidates[0]?.confidence,
        success: false,
        action: "clarify",
      });
      return { clarifyMessage: navResult.message, confidence: navResult.candidates[0]?.confidence ?? 0 };
    }

    return null;
  }

  async chat(params: {
    organizationId: string;
    propertyId: string;
    experienceId: string;
    query: string;
    activeSceneId?: string;
    sessionId?: string;
    brainProvider?: WalkthroughBrainProvider;
    voiceMode?: boolean;
  }): Promise<{
    answer: string;
    command: WalkthroughAICommand;
    confidenceScore: number;
    suggestedFollowups: string[];
    fallbackUsed: boolean;
    instantPath?: boolean;
  }> {
    const [contexts, nav] = await Promise.all([
      retrieveVoicePropertyContext({
        organizationId: params.organizationId,
        propertyId: params.propertyId,
        experienceId: params.experienceId,
        query: params.query,
        sceneId: params.activeSceneId,
      }),
      this.resolveNavigation(params.query, params.experienceId),
    ]);

    const fallbackUsed = shouldFallback(contexts, params.query, params.voiceMode);

    let command: WalkthroughAICommand = { command: "NONE" };
    if (isWaitIntent(params.query)) {
      const durationMs = parseWaitDurationMs(params.query) ?? 120_000;
      command = { command: "PAUSE_AUTOPLAY", durationMs };
    } else if (isResumeIntent(params.query)) {
      command = { command: "RESUME_AUTOPLAY" };
    } else if (/site visit|book|schedule|contact|call/i.test(params.query)) {
      command = { command: "OPEN_LEAD_FORM" };
    } else if (nav?.clarifyMessage) {
      return {
        answer: nav.clarifyMessage,
        command: { command: "NONE" },
        confidenceScore: nav.confidence ?? 0.4,
        suggestedFollowups: ["Go to the kitchen", "Show living room", "Take me to the bathroom"],
        fallbackUsed: false,
      };
    } else if (nav?.sceneId) {
      command = { command: "JUMP_TO_SCENE", sceneId: nav.sceneId };
    } else if (/show.*room|which room|rooms available/i.test(params.query)) {
      command = { command: "SHOW_ROOM_MENU" };
    }

    if (command.command === "PAUSE_AUTOPLAY") {
      return {
        answer: "I'll pause here — take your time. Say resume when you're ready, or tell me which room you'd like to see.",
        command,
        confidenceScore: 1,
        suggestedFollowups: ["Go to the kitchen", "Resume the tour", "What amenities are included?"],
        fallbackUsed: false,
      };
    }

    if (command.command === "RESUME_AUTOPLAY") {
      return {
        answer: "Perfect — let's continue the tour.",
        command,
        confidenceScore: 1,
        suggestedFollowups: ["Show me the living room", "Go to the master bedroom"],
        fallbackUsed: false,
      };
    }

    if (command.command === "JUMP_TO_SCENE" && nav?.label) {
      return {
        answer: `Absolutely — taking you to the ${nav.label} now.`,
        command,
        confidenceScore: nav.confidence ?? 1,
        suggestedFollowups: ["Tell me about this room", "What's nearby?", "Book a site visit"],
        fallbackUsed: false,
        instantPath: true,
      };
    }

    if (fallbackUsed && command.command === "NONE" && !params.voiceMode) {
      return {
        answer: "I don't have that specific detail on file yet — our sales team can confirm. Would you like me to connect you?",
        command,
        confidenceScore: 0,
        suggestedFollowups: ["Show me the living room", "What amenities are available?", "Book a site visit"],
        fallbackUsed: true,
      };
    }

    const instant = tryInstantKnowledgeAnswer(contexts, params.query);
    if (instant && command.command === "NONE") {
      return {
        answer: instant,
        command,
        confidenceScore: 0.95,
        suggestedFollowups: ["Show me another room", "Book a site visit"],
        fallbackUsed: false,
        instantPath: true,
      };
    }

    const contextBlock = contexts
      .map((c) => `[${c.category}] ${c.title}: ${c.content}`)
      .join("\n\n");

    const sceneList = nav?.label ? `Navigation match: ${nav.label}` : "";
    const userContent = `Property context:\n${contextBlock || "Use scene/tour details only."}\n\nCurrent scene: ${params.activeSceneId ?? "unknown"}. ${sceneList}\n\nBuyer question: ${params.query}`;

    const answer = await (async () => {
      const messages = [
        { role: "system" as const, content: WALKTHROUGH_SALES_AGENT_SYSTEM },
        { role: "user" as const, content: userContent },
      ];
      const result = await walkthroughBrainChat(messages, {
        provider: params.brainProvider,
        temperature: 0.25,
        maxOutputTokens: params.voiceMode ? WALKTHROUGH_VOICE_MAX_TOKENS : 512,
      });
      return result.text;
    })();

    const confidence = computeConfidence(contexts, params.query);
    const trimmed = answer.trim();

    return {
      answer: trimmed || "I'm here with you — what would you like to explore next in this property?",
      command,
      confidenceScore: confidence,
      suggestedFollowups: [
        "Show me the kitchen",
        "What amenities are included?",
        "Book a site visit",
      ],
      fallbackUsed: !trimmed,
    };
  }
}

export const walkthroughAgentService = new WalkthroughAgentService();
