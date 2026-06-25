import { vertexAIService } from "@/services/vertex-ai.service";
import {
  videoQualityValidationSchema,
  type VideoQualityValidation,
} from "@/types/video-quality-validation";

const VALIDATION_PROMPT = `You are a real-estate video quality inspector. Compare the SOURCE IMAGE (ground truth) with the GENERATED VIDEO clip.

Detect visual hallucinations or fidelity issues in the generated video:
- extra furniture, pillows, decor not in source
- added or removed people
- changed room layout or architecture
- changed wall/floor/material finishes
- unrealistic or distorted objects
- moved appliances or fixtures

The video may have subtle camera motion (dolly, parallax) — that is expected and NOT an issue.
Lighting shifts from motion are acceptable if layout and objects are preserved.

Return JSON only:
{
  "passed": boolean,
  "score": number between 0 and 1,
  "issues": string[],
  "summary": string,
  "recommendation": "approve" | "retry_same_model" | "needs_review"
}

Rules:
- passed=true only if score >= 0.75 and no major layout/object hallucinations
- recommendation "approve" only when passed=true
- recommendation "retry_same_model" for fixable generation artifacts
- recommendation "needs_review" when uncertain`;

function parseValidationJson(raw: string): VideoQualityValidation {
  const trimmed = raw.trim();
  const jsonMatch = trimmed.match(/\{[\s\S]*\}/);
  const parsed = JSON.parse(jsonMatch?.[0] ?? trimmed);
  const result = videoQualityValidationSchema.safeParse(parsed);
  if (result.success) return result.data;

  return {
    passed: false,
    score: 0,
    issues: ["Validation response could not be parsed"],
    summary: "AI quality check returned an invalid response.",
    recommendation: "needs_review",
  };
}

export async function validateGeneratedVideo(
  sourceImage: { buffer: Buffer; mimeType: string },
  video: { buffer: Buffer; mimeType: string },
): Promise<VideoQualityValidation> {
  try {
    const raw = await vertexAIService.validateVideoFidelity(
      sourceImage,
      video,
      VALIDATION_PROMPT,
    );
    return parseValidationJson(raw);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Validation failed";
    return {
      passed: false,
      score: 0,
      issues: [message],
      summary: "AI quality guard could not complete validation.",
      recommendation: "needs_review",
    };
  }
}
