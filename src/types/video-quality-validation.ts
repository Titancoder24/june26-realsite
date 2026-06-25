import { z } from "zod";

export const videoQualityValidationSchema = z.object({
  passed: z.boolean(),
  score: z.number().min(0).max(1),
  issues: z.array(z.string()),
  summary: z.string(),
  recommendation: z.enum(["approve", "retry_same_model", "needs_review"]),
});

export type VideoQualityValidation = z.infer<typeof videoQualityValidationSchema>;
