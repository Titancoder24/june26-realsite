import { NextResponse } from "next/server";
import { withAuth } from "@/lib/api-utils";
import { getVertexAIConfig, VERTEX_DEFAULTS } from "@/lib/platform-settings";
import { vertexAIService } from "@/services/vertex-ai.service";
import { DEFAULT_VEO_GENERATION_MODE, resolveVeoModelId } from "@/lib/veo-video-models";

export const maxDuration = 60;

export async function POST() {
  return withAuth(async () => {
    const vertex = await getVertexAIConfig();
    const hasVertexKey = Boolean(vertex.api_key ?? process.env.GOOGLE_VERTEX_API_KEY);
    const hasProject = Boolean(vertex.project_id ?? process.env.GOOGLE_CLOUD_PROJECT);

    const results: {
      provider: "vertex";
      planner: { ok: boolean; model?: string; latency_ms?: number; error?: string };
      video: { ok: boolean; model?: string; operation?: string; error?: string };
      embedding: { ok: boolean; dimensions?: number; error?: string };
      config: {
        vertex_configured: boolean;
        project_id: string;
        location: string;
      };
    } = {
      provider: "vertex",
      planner: { ok: false },
      video: { ok: false },
      embedding: { ok: false },
      config: {
        vertex_configured: hasVertexKey && hasProject,
        project_id: vertex.project_id ?? "",
        location: vertex.location ?? VERTEX_DEFAULTS.location,
      },
    };

    if (!hasVertexKey || !hasProject) {
      return NextResponse.json({
        ok: false,
        ...results,
        planner: { ok: false, error: "GOOGLE_VERTEX_API_KEY and GOOGLE_CLOUD_PROJECT required" },
        video: { ok: false, error: "GOOGLE_VERTEX_API_KEY and GOOGLE_CLOUD_PROJECT required" },
        embedding: { ok: false, error: "GOOGLE_VERTEX_API_KEY and GOOGLE_CLOUD_PROJECT required" },
      }, { status: 400 });
    }

    const plannerStart = Date.now();
    try {
      const raw = await vertexAIService.planScenes(
        [],
        {
          propertyType: "residential",
          propertyName: "Pipeline Health Check",
          promptText: 'Return JSON only: {"tour_title":"Health Check","property_type":"residential","flow_warnings":[],"scenes":[]}',
        },
      );
      const parsed = JSON.parse(raw);
      results.planner = {
        ok: Boolean(parsed?.tour_title !== undefined || parsed?.scenes !== undefined),
        model: vertex.planner_model,
        latency_ms: Date.now() - plannerStart,
      };
    } catch (err) {
      results.planner = {
        ok: false,
        model: vertex.planner_model,
        latency_ms: Date.now() - plannerStart,
        error: err instanceof Error ? err.message : "Planner test failed",
      };
    }

    try {
      const { operationName, model } = await vertexAIService.submitVideoJob(
        "Slow cinematic dolly forward through a modern living room. No people. Premium real estate.",
        { model: resolveVeoModelId(DEFAULT_VEO_GENERATION_MODE) },
      );
      results.video = {
        ok: Boolean(operationName),
        model,
        operation: operationName,
      };
    } catch (err) {
      results.video = {
        ok: false,
        model: vertex.video_model,
        error: err instanceof Error ? err.message : "Video submit test failed",
      };
    }

    try {
      const vec = await vertexAIService.embedText("health check embedding", 1536);
      results.embedding = { ok: vec.length === 1536, dimensions: vec.length };
    } catch (err) {
      results.embedding = {
        ok: false,
        error: err instanceof Error ? err.message : "Embedding test failed",
      };
    }

    const healthy = results.planner.ok && results.embedding.ok;
    return NextResponse.json({ ok: healthy, ...results }, { status: healthy ? 200 : 502 });
  }, "platform_admin");
}
