import { NextResponse } from "next/server";
import { z } from "zod";
import { spatialGenerationService } from "@/services/spatial-generation.service";
import { createAdminClient } from "@/lib/supabase/admin";
import { withAuth, jsonError } from "@/lib/api-utils";
import { enqueueWorldLabsJob } from "@/lib/queue/worldlabs-queue";

const schema = z.object({
  experienceId: z.string().uuid(),
  propertyId: z.string().uuid(),
  organizationId: z.string().uuid().optional(),
  mediaAssetIds: z.array(z.string().uuid()).optional(),
  prompt: z.string().optional(),
  model: z.string().optional(),
});

export async function POST(req: Request) {
  return withAuth(async (profile) => {
    try {
      const body = schema.parse(await req.json());
      const admin = createAdminClient();
      const { data: property } = await admin.from("properties").select("organization_id").eq("id", body.propertyId).single();
      if (!property) return jsonError("Property not found", 404);
      if (property.organization_id !== profile.organization_id) return jsonError("Forbidden", 403);

      const result = await spatialGenerationService.generate("worldlabs_splat", {
        experienceId: body.experienceId,
        propertyId: body.propertyId,
        organizationId: property.organization_id,
        mediaAssetIds: body.mediaAssetIds ?? [],
        prompt: body.prompt,
        model: body.model,
      });

      if (result.jobId) {
        const mode = await enqueueWorldLabsJob(result.jobId);
        return NextResponse.json({ jobId: result.jobId, status: result.status, queue: mode });
      }
      return NextResponse.json({ jobId: result.jobId, status: result.status });
    } catch (err) {
      return jsonError(err instanceof Error ? err.message : "Generation failed", 500);
    }
  }, "project_manager");
}
