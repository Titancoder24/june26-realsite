import { NextResponse } from "next/server";
import { z } from "zod";
import { withAuth } from "@/lib/api-utils";
import {
  fallbackCoachResult,
  getSalesScenario,
  type SalesTrainingCoachResult,
  type SalesTrainingDifficulty,
  type SalesTrainingMessage,
  type SalesTrainingMode,
  type SalesTrainingScenarioId,
} from "@/lib/sales-training";
import { googleAIStudioService } from "@/services/google-ai-studio.service";
import { salesTrainingService } from "@/services/sales-training.service";
import type { VertexChatMessage } from "@/services/vertex-ai.service";

export const runtime = "nodejs";

const schema = z.object({
  scenarioId: z.string().optional(),
  sessionId: z.string().uuid().optional(),
  mode: z.enum(["text", "voice"]).default("text"),
  difficulty: z.enum(["easy", "medium", "hard", "elite"]).default("medium"),
  datasetIds: z.array(z.string().uuid()).default([]),
  input: z.string().min(1),
  conversation: z.array(z.object({
    role: z.enum(["agent", "buyer", "coach"]),
    content: z.string(),
  })).default([]),
  agentName: z.string().optional(),
});

function extractJson(text: string): SalesTrainingCoachResult | null {
  const cleaned = text.replace(/^```json\s*/i, "").replace(/```$/i, "").trim();
  const match = cleaned.match(/\{[\s\S]*\}/);
  try {
    return JSON.parse(match?.[0] ?? cleaned) as SalesTrainingCoachResult;
  } catch {
    return null;
  }
}

export async function POST(req: Request) {
  return withAuth(async (profile) => {
    const body = schema.parse(await req.json());
    const scenario = getSalesScenario(body.scenarioId);
    const session = body.sessionId
      ? (await salesTrainingService.getSession(profile, body.sessionId)).session
      : await salesTrainingService.createSession(profile, {
          scenarioId: scenario.id as SalesTrainingScenarioId,
          mode: body.mode as SalesTrainingMode,
          difficulty: body.difficulty as SalesTrainingDifficulty,
          datasetIds: body.datasetIds,
        });
    if (body.datasetIds.length) {
      await salesTrainingService.attachDatasets(profile, session.id, body.datasetIds);
    }
    const stored = await salesTrainingService.getSession(profile, session.id);
    await salesTrainingService.addMessage(profile, session.id, {
      role: "agent",
      content: body.input,
      inputMode: body.mode as SalesTrainingMode,
    });
    const conversation: SalesTrainingMessage[] = [
      ...stored.messages,
      ...body.conversation,
      { role: "agent", content: body.input, inputMode: body.mode as SalesTrainingMode },
    ];
    const fallback = fallbackCoachResult(scenario, conversation);
    const datasetContext = stored.datasets
      .map((dataset) => `DATASET: ${dataset.title}\nTYPE: ${dataset.source_type}\nCONTENT:\n${dataset.text_content.slice(0, 8_000)}`)
      .join("\n\n---\n\n");
    const memory = await salesTrainingService.retrieveRelevantMemory(profile, {
      query: body.input,
      limit: 8,
    });
    const memoryContext = memory
      .map((item) => `${item.role.toUpperCase()}: ${item.content}`)
      .join("\n");

    const prompt = `
You are a real estate sales training AI for a property developer's sales team.
Act as a realistic Indian real-estate buyer first, then as an elite sales coach.
Train the agent to become a top 0.001% real-estate salesperson in India: calm, ethical, sharp, consultative, commercially strong, and never pushy.
Difficulty level: ${body.difficulty}. If hard/elite, make objections more nuanced and score more strictly.
Tone requirement: simple English, easy to understand, practical, medium warmth, high clarity.
Mode: ${body.mode}. For voice mode, keep buyer replies more conversational and coach notes easy to speak aloud.

Training scenario:
- Title: ${scenario.title}
- Buyer profile: ${scenario.buyerProfile}
- Goal: ${scenario.goal}
- Context and compliance: ${scenario.context}
- Manager focus: ${scenario.managerFocus.join(", ")}

Agent-provided context dataset:
${datasetContext || "No extra dataset provided. Use only the scenario context."}

Relevant saved training memory:
${memoryContext || "No prior memory found yet."}

Recent conversation:
${conversation.map((m) => `${m.role.toUpperCase()}: ${m.content}`).join("\n")}

Return only valid JSON with this exact shape:
{
  "buyerReply": "one realistic buyer reply, 1-3 sentences",
  "coachNote": "one short coaching note",
  "score": {
    "discovery": 0-100,
    "objectionHandling": 0-100,
    "productKnowledge": 0-100,
    "empathy": 0-100,
    "closing": 0-100,
    "compliance": 0-100
  },
  "readinessScore": 0-100,
  "strengths": ["max 3"],
  "improvements": ["max 3"],
  "managerSummary": "one manager-facing summary",
  "nextDrill": "one recommended drill"
}
`;

    let result = fallback;
    try {
      const messages: VertexChatMessage[] = [
        {
          role: "system",
          content:
            "You are strict, practical, and realistic. Never recommend false promises, guaranteed returns, unapproved discounts, RERA/legal claims without verification, or manipulative pressure. Score readiness honestly like a sales manager training elite Indian real-estate agents.",
        },
        { role: "user", content: prompt },
      ];
      const aiText = await googleAIStudioService.chat(messages, {
        model: "gemini-3-flash-preview",
        temperature: 0.35,
        maxOutputTokens: 900,
      });
      result = extractJson(aiText) ?? fallback;
    } catch {
      result = fallback;
    }
    await salesTrainingService.addMessage(profile, session.id, { role: "buyer", content: result.buyerReply, inputMode: body.mode as SalesTrainingMode });
    await salesTrainingService.addMessage(profile, session.id, { role: "coach", content: result.coachNote, inputMode: body.mode as SalesTrainingMode });
    await salesTrainingService.saveAssessment(profile, session.id, result);

    return NextResponse.json({
      ...result,
      scenario,
      sessionId: session.id,
      agentId: profile.id,
      organizationId: profile.organization_id,
      model: "gemini-flash",
    });
  }, "sales_agent");
}
