import { parseWalkthroughPlan, type WalkthroughPlanPayload } from "@/lib/walkthrough-planner-schema";
import { vertexAIService } from "./vertex-ai.service";
import type { ScenePlanResult, WalkthroughMotionType } from "@/types/cinematic-walkthrough";

const PROPERTY_FLOWS: Record<string, string> = {
  residential: "exterior → entrance → living → dining → kitchen → balcony → bedrooms → bathrooms → amenities → CTA",
  villa: "exterior → gate → entrance → living → dining → kitchen → master bedroom → pool → garden → terrace → CTA",
  office: "building exterior → reception → lift lobby → floor plate → open workspace → cabins → conference rooms → pantry → parking → leasing CTA",
  coworking: "reception → lounge → hot desk → private cabin → meeting room → phone booth → event space → cafe → pricing CTA",
  warehouse: "gate → loading bay → storage → production floor → admin office → parking → compliance zones → CTA",
  factory: "gate → loading bay → production floor → storage → admin office → parking → fire safety → CTA",
  interior: "entrance → living → dining → kitchen → bedroom → bathroom → detail shots → materials → CTA",
};

function buildPlannerPrompt(propertyType: string, propertyName?: string) {
  const flow = PROPERTY_FLOWS[propertyType] ?? PROPERTY_FLOWS.residential;
  return `You are a Property Walkthrough planner for real estate. Analyze property images and return strict JSON only.
Property: ${propertyName ?? "Unnamed property"}
Property type: ${propertyType}
Recommended flow: ${flow}

For each image: classify room_type, title, description, sales caption, motion, order, duration (4-8 sec), conservative Veo video prompt, objects, annotation pins (normalized x/y 0-1), quality notes.
Veo prompts must preserve exact architecture, furniture, layout. No people. No fake furniture. No distortion.
Return JSON object:
{
  "tour_title": "Premium Villa Walkthrough",
  "property_type": "${propertyType}",
  "flow_warnings": ["optional warnings"],
  "scenes": [{
    "image_id": "uuid",
    "room_type": "exterior|entrance|living_room|kitchen|...",
    "title": "Modern Kitchen",
    "description": "Brief scene description",
    "caption": "Sales caption",
    "suggested_motion": "push_in",
    "suggested_order": 1,
    "duration": 6,
    "veo_prompt": "Real estate walkthrough motion from this kitchen. Slow forward dolly with subtle parallax. Preserve exact architecture, furniture, walls, flooring, lighting proportions. No people. No changes to layout. No added objects. Professional real estate quality.",
    "important_objects": ["island"],
    "suggested_annotations": [{"title": "Kitchen island", "x": 0.5, "y": 0.6, "category": "feature"}],
    "quality_notes": "Assessment",
    "include": true,
    "warnings": []
  }]
}`;
}

function toScenePlanResults(plan: WalkthroughPlanPayload): ScenePlanResult[] {
  return plan.scenes.map((p) => ({
    image_id: p.image_id,
    room_type: p.room_type,
    title: p.title,
    description: p.description,
    caption: p.caption,
    suggested_motion: p.suggested_motion as WalkthroughMotionType,
    suggested_order: p.suggested_order,
    duration: p.duration,
    veo_prompt: p.veo_prompt,
    important_objects: p.important_objects,
    suggested_annotations: p.suggested_annotations.map((a) => ({
      title: a.title,
      x: a.x,
      y: a.y,
      category: a.category,
    })),
    quality_notes: p.quality_notes,
    include: p.include,
    warnings: p.warnings,
  }));
}

export class WalkthroughPlannerService {
  async planScenes(
    images: { id: string; url: string; file_name: string }[],
    options?: { propertyType?: string; propertyName?: string },
  ): Promise<{ plan: WalkthroughPlanPayload; plans: ScenePlanResult[]; flow_warnings: string[] }> {
    const propertyType = options?.propertyType ?? "residential";
    const promptText = `${buildPlannerPrompt(propertyType, options?.propertyName)}\n\nImages:\n${images.map((img, i) => `${i + 1}. id=${img.id} file=${img.file_name}`).join("\n")}`;

    let raw = await vertexAIService.planScenes(images, { ...options, promptText });

    let parsed: unknown;
    try {
      parsed = JSON.parse(raw);
    } catch {
      raw = await vertexAIService.generateJSON(
        `Fix the JSON and return only valid JSON matching the walkthrough plan schema.\n\n${raw}`,
        { temperature: 0 },
      );
      parsed = JSON.parse(raw);
    }

    const plan = parseWalkthroughPlan(parsed, images.map((img) => img.id), propertyType);
    const plans = toScenePlanResults(plan);
    return { plan, plans, flow_warnings: plan.flow_warnings };
  }

  async extractRagFromChat(
    userMessage: string,
    conversationHistory: { role: string; content: string }[],
  ): Promise<{
    reply: string;
    structured: unknown;
    entries: { category: string; title: string; content: string }[];
  }> {
    const historyText = conversationHistory
      .map((m) => `${m.role}: ${m.content}`)
      .join("\n");

    const raw = await vertexAIService.generateJSON(
      `You help real estate teams build approved property knowledge for an AI assistant.
Extract structured property facts from user messages. Only include facts explicitly stated — do not invent data.
Assign a confidence score (0.0-1.0) for each extracted field based on how clearly the source text supports it.

Return JSON with this exact shape:
{
  "reply": "Brief friendly confirmation (1-2 sentences). Do NOT list all facts in reply — the UI renders them separately.",
  "overall_confidence": 0.0,
  "structured": {
    "property_name": { "value": "", "confidence": 0.0 },
    "property_type": { "value": "", "confidence": 0.0 },
    "location": { "value": "", "confidence": 0.0 },
    "overview": { "value": "", "confidence": 0.0 },
    "property_size": { "value": "", "confidence": 0.0 },
    "rooms": { "items": [{ "text": "", "confidence": 0.0 }], "confidence": 0.0 },
    "amenities": { "items": [{ "text": "", "confidence": 0.0 }], "confidence": 0.0 },
    "interior_materials": { "items": [{ "text": "", "confidence": 0.0 }], "confidence": 0.0 },
    "smart_features": { "items": [{ "text": "", "confidence": 0.0 }], "confidence": 0.0 },
    "nearby_landmarks": { "items": [{ "text": "", "confidence": 0.0 }], "confidence": 0.0 },
    "faqs": { "items": [{ "question": "", "answer": "", "confidence": 0.0 }], "confidence": 0.0 },
    "unknown_answer_rules": { "value": "How the assistant should respond when information is missing", "confidence": 0.0 }
  },
  "entries": [{ "category": "pricing", "title": "Starting price", "content": "..." }]
}

Also include legacy RAG entries for pricing, possession, rera, legal, availability when present.
Omit empty sections from structured. Use lower confidence when inferred rather than explicit.

Conversation:
${historyText}

Latest user message:
${userMessage}`,
      { temperature: 0.1 },
    );

    const parsed = JSON.parse(raw);
    return {
      reply: String(parsed.reply ?? "I've extracted property knowledge from your message."),
      structured: parsed.structured ?? parsed,
      entries: Array.isArray(parsed.entries)
        ? parsed.entries.map((e: { category?: string; title?: string; content?: string }) => ({
            category: String(e.category ?? "project_details"),
            title: String(e.title ?? "Property detail"),
            content: String(e.content ?? ""),
          }))
        : [],
    };
  }

  async suggestAnnotationFromText(
    userText: string,
    sceneTitle: string,
  ): Promise<{ title: string; short_description: string; description: string; category: string; ai_context: string }> {
    const raw = await vertexAIService.generateJSON(
      `Convert natural language pin descriptions into structured annotation JSON for scene "${sceneTitle}".
Return JSON: {"title":"","short_description":"","description":"","category":"feature|material|amenity|view|leasing|compliance|cta","ai_context":""}

User text: ${userText}`,
      { temperature: 0.15, maxOutputTokens: 1024 },
    );
    const parsed = JSON.parse(raw);
    return {
      title: String(parsed.title ?? "Feature"),
      short_description: String(parsed.short_description ?? parsed.title ?? ""),
      description: String(parsed.description ?? ""),
      category: String(parsed.category ?? "feature"),
      ai_context: String(parsed.ai_context ?? userText),
    };
  }
}

export const walkthroughPlannerService = new WalkthroughPlannerService();
