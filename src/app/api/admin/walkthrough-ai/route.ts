import { NextResponse } from "next/server";
import { z } from "zod";
import { withAuth } from "@/lib/api-utils";
import {
  getWalkthroughAIProvider,
  getVertexAIConfig,
  setPlatformSetting,
  clearPlatformSettingsCache,
  VERTEX_DEFAULTS,
  type VertexAIConfig,
} from "@/lib/platform-settings";
import { createAdminClient } from "@/lib/supabase/admin";

export async function GET() {
  return withAuth(async () => {
    const provider = await getWalkthroughAIProvider();
    const vertex = await getVertexAIConfig();
    const hasVertexKey = Boolean(vertex.api_key ?? process.env.GOOGLE_VERTEX_API_KEY);
    const hasProject = Boolean(vertex.project_id ?? process.env.GOOGLE_CLOUD_PROJECT);

    return NextResponse.json({
      provider,
      vertex_only: true,
      openrouter: {
        configured: false,
        note: "Walkthrough pipeline uses Vertex AI only",
      },
      vertex: {
        configured: hasVertexKey && hasProject,
        planner_model: vertex.planner_model ?? VERTEX_DEFAULTS.planner_model,
        image_model: vertex.image_model ?? VERTEX_DEFAULTS.image_model,
        video_model: vertex.video_model ?? VERTEX_DEFAULTS.video_model,
        embedding_model: vertex.embedding_model ?? VERTEX_DEFAULTS.embedding_model,
        location: vertex.location ?? VERTEX_DEFAULTS.location,
        project_id: vertex.project_id ?? "",
        api_key_set: hasVertexKey,
        api_key_preview: vertex.api_key ? `${vertex.api_key.slice(0, 6)}…` : (process.env.GOOGLE_VERTEX_API_KEY ? "env" : ""),
      },
    });
  }, "platform_admin");
}

const patchSchema = z.object({
  vertex_api_key: z.string().optional(),
  vertex_project_id: z.string().optional(),
  vertex_location: z.string().optional(),
  vertex_planner_model: z.string().optional(),
  vertex_image_model: z.string().optional(),
  vertex_video_model: z.string().optional(),
  reason: z.string().optional(),
});

export async function PATCH(req: Request) {
  return withAuth(async (profile) => {
    const body = patchSchema.parse(await req.json());
    const existing = await getVertexAIConfig();

    const nextVertex = {
      ...existing,
      api_key: body.vertex_api_key?.trim() || existing.api_key,
      project_id: body.vertex_project_id !== undefined ? body.vertex_project_id.trim() : existing.project_id,
      location: body.vertex_location?.trim() || existing.location || VERTEX_DEFAULTS.location,
      planner_model: body.vertex_planner_model?.trim() || existing.planner_model || VERTEX_DEFAULTS.planner_model,
      image_model: body.vertex_image_model?.trim() || existing.image_model || VERTEX_DEFAULTS.image_model,
      video_model: body.vertex_video_model?.trim() || existing.video_model || VERTEX_DEFAULTS.video_model,
    };

    const vertexTouched =
      body.vertex_api_key !== undefined ||
      body.vertex_project_id !== undefined ||
      body.vertex_location !== undefined ||
      body.vertex_planner_model !== undefined ||
      body.vertex_image_model !== undefined ||
      body.vertex_video_model !== undefined;

    if (vertexTouched) {
      await setPlatformSetting("vertex_ai_config", nextVertex, profile.id);
    }

    const admin = createAdminClient();
    await admin.from("admin_audit_logs").insert({
      actor_id: profile.id,
      action: "walkthrough_vertex_config_save",
      target_type: "platform_settings",
      target_id: "vertex_ai_config",
      reason: body.reason ?? "Vertex credentials saved",
      payload: { provider: "vertex", project_id: nextVertex.project_id, has_api_key: Boolean(nextVertex.api_key) },
    });

    clearPlatformSettingsCache();

    const safeVertex: VertexAIConfig = {
      ...nextVertex,
      api_key: nextVertex.api_key ? `${nextVertex.api_key.slice(0, 6)}…` : undefined,
    };

    return NextResponse.json({
      ok: true,
      provider: "vertex" as const,
      vertex: {
        ...safeVertex,
        api_key_set: Boolean(nextVertex.api_key),
        configured: Boolean(nextVertex.api_key),
      },
    });
  }, "platform_admin");
}
