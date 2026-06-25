import { createAdminClient } from "@/lib/supabase/admin";

export type ApiProvider = "openrouter" | "vertex" | "elevenlabs" | "sarvam" | "worldlabs" | "internal";

export async function logApiUsage(entry: {
  provider: ApiProvider;
  operation: string;
  model?: string;
  organizationId?: string;
  userId?: string;
  experienceId?: string;
  status?: "success" | "failed" | "queued";
  tokensEstimated?: number;
  metadata?: Record<string, unknown>;
}) {
  try {
    const admin = createAdminClient();
    await admin.from("api_usage_logs").insert({
      provider: entry.provider,
      operation: entry.operation,
      model: entry.model ?? null,
      organization_id: entry.organizationId ?? null,
      user_id: entry.userId ?? null,
      experience_id: entry.experienceId ?? null,
      status: entry.status ?? "success",
      tokens_estimated: entry.tokensEstimated ?? null,
      metadata: entry.metadata ?? {},
    });
  } catch {
    // Non-blocking — analytics should not break product flows
  }
}
