import {
  buildFallbackPlan,
  parseWalkthroughPlan,
  type ScenePlanItem,
  type WalkthroughPlanPayload,
} from "@/lib/walkthrough-planner-schema";
import { vertexAIService } from "./vertex-ai.service";
import type { ScenePlanResult } from "@/types/cinematic-walkthrough";

const PROPERTY_FLOWS: Record<string, string> = {
  residential: "exterior → entrance → living → dining → kitchen → balcony → bedrooms → bathrooms → amenities → CTA",
  villa: "exterior → gate → entrance → living → dining → kitchen → master bedroom → pool → garden → terrace → CTA",
  office: "building exterior → reception → lift lobby → floor plate → open workspace → cabins → conference rooms → pantry → parking → leasing CTA",
  indian_apartment: "exterior → entrance → living → dining → kitchen → bedrooms → bathrooms → balcony → amenities → parking",
};

const BATCH_SIZE = 8;

function buildPlannerPrompt(
  propertyType: string,
  propertyName?: string,
  images?: { id: string; file_name: string }[],
  batchNote?: string,
) {
  const flow = PROPERTY_FLOWS[propertyType] ?? PROPERTY_FLOWS.residential;
  return `You are a Property Walkthrough planner for Indian and international real estate listings.
Analyze each property PHOTO (ignore file names) and return strict JSON only.

Property: ${propertyName ?? "Unnamed property"}
Property type: ${propertyType}
Recommended buyer flow: ${flow}
${batchNote ?? ""}

CRITICAL naming rules:
- NEVER use screenshot/file names in titles.
- Use buyer-friendly display names like: "Exterior Front View", "Entrance", "Living Room", "Dining Area", "Kitchen", "Master Bedroom", "Bedroom 2", "Bathroom", "Balcony", "Staircase", "Parking", "Amenities".
- If unsure, set title to "Needs Review" and needs_review=true.

For EACH image return:
- room_type (exterior|entrance|living_room|dining_area|kitchen|master_bedroom|bedroom|bedroom_2|bedroom_3|bathroom|balcony|staircase|parking|amenities|utility|study|terrace|garden|pool|unknown)
- title (display name for buyers)
- description, caption
- classification_confidence (0.0-1.0)
- classification_reason (one short sentence explaining what you see)
- needs_review (true if confidence < 0.65 or room unclear)
- suggested_motion, suggested_order, duration (4-8 sec)
- veo_prompt (conservative — preserve exact architecture, no people)
- suggested_annotations (max 3 pins, normalized x/y 0-1)
- include (true unless duplicate/low quality)

Return JSON:
{"tour_title":"","property_type":"${propertyType}","flow_warnings":[],"scenes":[{"image_id":"uuid","room_type":"kitchen","title":"Kitchen","description":"","caption":"","classification_confidence":0.92,"classification_reason":"Visible modular kitchen with hob and chimney","needs_review":false,"suggested_motion":"push_in","suggested_order":1,"duration":6,"veo_prompt":"","important_objects":[],"suggested_annotations":[],"quality_notes":"","include":true,"warnings":[]}]}

Images in this batch:
${(images ?? []).map((img, i) => `${i + 1}. id=${img.id}`).join("\n")}`;
}

function toScenePlanResults(plan: WalkthroughPlanPayload): ScenePlanResult[] {
  return plan.scenes.map((p) => ({
    image_id: p.image_id,
    room_type: p.room_type,
    title: p.title,
    description: p.description,
    caption: p.caption,
    suggested_motion: p.suggested_motion,
    suggested_order: p.suggested_order,
    duration: p.duration,
    veo_prompt: p.veo_prompt,
    important_objects: p.important_objects,
    suggested_annotations: p.suggested_annotations,
    quality_notes: p.quality_notes,
    classification_confidence: p.classification_confidence,
    classification_reason: p.classification_reason,
    needs_review: p.needs_review,
    include: p.include,
    warnings: p.warnings,
  }));
}

function mergeBatchScenes(allScenes: ScenePlanItem[]): ScenePlanItem[] {
  const flowRank: Record<string, number> = {
    exterior: 1, entrance: 2, living_room: 3, dining_area: 4, kitchen: 5,
    balcony: 6, master_bedroom: 7, bedroom: 8, bedroom_2: 9, bedroom_3: 10,
    bathroom: 11, staircase: 12, amenities: 13, parking: 14, utility: 15, study: 16,
    terrace: 17, garden: 18, pool: 19, unknown: 99,
  };
  return [...allScenes]
    .sort((a, b) => {
      const rankA = flowRank[a.room_type] ?? 50;
      const rankB = flowRank[b.room_type] ?? 50;
      if (rankA !== rankB) return rankA - rankB;
      return a.suggested_order - b.suggested_order;
    })
    .map((scene, index) => ({ ...scene, suggested_order: index + 1 }));
}

async function planBatch(
  images: { id: string; url: string; file_name: string }[],
  options: { propertyType: string; propertyName?: string; batchIndex: number; batchTotal: number },
): Promise<WalkthroughPlanPayload> {
  const batchNote = options.batchTotal > 1
    ? `This is batch ${options.batchIndex + 1} of ${options.batchTotal}. Classify ONLY the listed image IDs.`
    : undefined;
  const promptText = buildPlannerPrompt(options.propertyType, options.propertyName, images, batchNote);
  let raw = await vertexAIService.planScenes(images, { ...options, promptText });

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    raw = await vertexAIService.generateJSON(
      `Fix the JSON and return only valid walkthrough plan JSON with all required scene fields.\n\n${raw}`,
      { temperature: 0 },
    );
    parsed = JSON.parse(raw);
  }

  return parseWalkthroughPlan(parsed, images.map((img) => img.id), options.propertyType);
}

export async function planWalkthroughScenes(
  images: { id: string; url: string; file_name: string }[],
  options?: { propertyType?: string; propertyName?: string },
): Promise<{ plan: WalkthroughPlanPayload; plans: ScenePlanResult[]; flow_warnings: string[]; provider: string }> {
  const propertyType = options?.propertyType ?? "residential";
  const imageIds = images.map((img) => img.id);
  const warnings: string[] = [];

  try {
    const batches: typeof images[] = [];
    for (let i = 0; i < images.length; i += BATCH_SIZE) {
      batches.push(images.slice(i, i + BATCH_SIZE));
    }

    const batchPlans: WalkthroughPlanPayload[] = [];
    for (let i = 0; i < batches.length; i++) {
      batchPlans.push(await planBatch(batches[i], {
        propertyType,
        propertyName: options?.propertyName,
        batchIndex: i,
        batchTotal: batches.length,
      }));
    }

    const mergedScenes = mergeBatchScenes(batchPlans.flatMap((p) => p.scenes));
    const missingIds = imageIds.filter((id) => !mergedScenes.some((s) => s.image_id === id));
    if (missingIds.length) {
      warnings.push(`${missingIds.length} image(s) missing from AI plan — marked for manual review.`);
      for (const id of missingIds) {
        mergedScenes.push({
          image_id: id,
          room_type: "unknown",
          title: "Needs Review",
          description: "",
          caption: "",
          suggested_motion: "push_in",
          suggested_order: mergedScenes.length + 1,
          duration: 6,
          veo_prompt: "",
          important_objects: [],
          suggested_annotations: [],
          quality_notes: "",
          classification_confidence: 0.3,
          classification_reason: "Image was not classified by AI — please review manually.",
          needs_review: true,
          include: true,
          warnings: ["needs_review"],
        });
      }
    }

    const plan: WalkthroughPlanPayload = {
      tour_title: batchPlans[0]?.tour_title ?? "Property Walkthrough",
      property_type: propertyType,
      flow_warnings: [...new Set([...batchPlans.flatMap((p) => p.flow_warnings), ...warnings])],
      scenes: mergeBatchScenes(mergedScenes),
    };

    return { plan, plans: toScenePlanResults(plan), flow_warnings: plan.flow_warnings, provider: "vertex" };
  } catch (err) {
    const msg = err instanceof Error ? err.message : "AI planning failed";
    warnings.push(`Vertex AI planner unavailable (${msg}) — created scenes from your uploaded images.`);
    const plan = buildFallbackPlan(images, propertyType);
    plan.flow_warnings = [...plan.flow_warnings, ...warnings];
    return { plan, plans: toScenePlanResults(plan), flow_warnings: plan.flow_warnings, provider: "fallback" };
  }
}
