import type { AIResponse } from "@/types/domain";
import {
  buildGroundedMessages,
  computeConfidence,
  isSensitiveQuery,
  shouldFallback,
} from "@/lib/grounded-ai";
import { ragService } from "./rag.service";
import { vertexAIService } from "./vertex-ai.service";

const FALLBACK =
  "I do not have that exact information in the developer-approved property data. I can connect you with the sales team to confirm it.";

export class AIService {
  async answer(params: {
    organizationId: string;
    propertyId: string;
    query: string;
    sceneId?: string;
    checkpointId?: string;
    sessionId?: string;
  }): Promise<AIResponse> {
    const contexts = await ragService.retrieve({
      organizationId: params.organizationId,
      propertyId: params.propertyId,
      query: params.query,
      sceneId: params.sceneId,
      checkpointId: params.checkpointId,
    });

    const sensitive = isSensitiveQuery(params.query);
    const fallbackUsed = shouldFallback(contexts, params.query);

    if (fallbackUsed) {
      return {
        answer: FALLBACK,
        retrievedSources: contexts,
        confidenceScore: computeConfidence(contexts, params.query),
        sensitiveTopic: sensitive,
        fallbackUsed: true,
        humanEscalation: sensitive,
      };
    }

    const messages = buildGroundedMessages(params.query, contexts, params.sceneId);
    const answer = await vertexAIService.chat(messages, { temperature: 0.15, maxOutputTokens: 1024 });
    const confidence = computeConfidence(contexts, params.query);

    return {
      answer,
      retrievedSources: contexts,
      confidenceScore: confidence,
      sensitiveTopic: sensitive,
      fallbackUsed: answer === FALLBACK,
      humanEscalation: sensitive && confidence < 0.6,
    };
  }
}

export const aiService = new AIService();
