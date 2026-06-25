import type { RAGContext } from "@/types/domain";
import { WALKTHROUGH_SALES_AGENT_SYSTEM } from "@/lib/walkthrough-sales-agent-prompt";

const SENSITIVE_TOPICS = [
  "price", "pricing", "cost", "area", "possession", "rera", "legal",
  "bank", "loan", "tax", "offer", "discount", "availability", "booking", "refund",
];

export const GROUNDED_AI_SYSTEM_PROMPT = WALKTHROUGH_SALES_AGENT_SYSTEM;

export function buildGroundedMessages(query: string, contexts: RAGContext[], sceneContext?: string) {
  const contextBlock = contexts
    .map((c) => `[${c.category}] ${c.title}: ${c.content}`)
    .join("\n\n");

  return [
    { role: "system" as const, content: GROUNDED_AI_SYSTEM_PROMPT },
    {
      role: "user" as const,
      content: `Property context:\n${contextBlock || "Tour/scene details available — use room descriptions from the walkthrough."}\n\nCurrent scene: ${sceneContext ?? "unknown"}\n\nBuyer question: ${query}`,
    },
  ];
}

export function isSensitiveQuery(query: string): boolean {
  const lower = query.toLowerCase();
  return SENSITIVE_TOPICS.some((t) => lower.includes(t));
}

export function computeConfidence(contexts: RAGContext[], query: string): number {
  if (!contexts.length) return 0.35;
  const avg = contexts.reduce((s, c) => s + c.score, 0) / contexts.length;
  const sensitive = isSensitiveQuery(query);
  if (sensitive && avg < 0.7) return Math.min(avg, 0.4);
  return avg;
}

/** Voice mode always reaches the LLM — only block bare sensitive claims without any context. */
export function shouldFallback(contexts: RAGContext[], query: string, voiceMode = false): boolean {
  if (voiceMode) return false;
  if (!contexts.length) return true;
  if (!isSensitiveQuery(query)) return false;
  const lower = query.toLowerCase();
  const hasSensitiveSupport = contexts.some((c) => {
    const blob = `${c.category} ${c.title} ${c.content}`.toLowerCase();
    return SENSITIVE_TOPICS.some((t) => lower.includes(t) && blob.includes(t));
  });
  return !hasSensitiveSupport && computeConfidence(contexts, query) < 0.45;
}
