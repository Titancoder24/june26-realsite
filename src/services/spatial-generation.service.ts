import { createAdminClient } from "@/lib/supabase/admin";
import type { ExperienceType, SpatialGenerationInput, SpatialGenerationResult } from "@/types/domain";
import { worldLabsService } from "./world-labs.service";
import { spaitialService } from "./spaitial.service";

export interface SpatialEngine {
  type: ExperienceType;
  generate(input: SpatialGenerationInput): Promise<SpatialGenerationResult>;
}

class Tour360Engine implements SpatialEngine {
  type: ExperienceType = "360_realistic";

  async generate(input: SpatialGenerationInput): Promise<SpatialGenerationResult> {
    const supabase = createAdminClient();
    await supabase
      .from("experiences")
      .update({ status: "ready_for_review", updated_at: new Date().toISOString() })
      .eq("id", input.experienceId);
    return { engine: this.type, status: "ready_for_review" };
  }
}

class WorldLabsEngine implements SpatialEngine {
  type: ExperienceType = "worldlabs_splat";

  async generate(input: SpatialGenerationInput): Promise<SpatialGenerationResult> {
    const supabase = createAdminClient();

    const { data: job, error } = await supabase
      .from("worldlabs_jobs")
      .insert({
        organization_id: input.organizationId,
        property_id: input.propertyId,
        experience_id: input.experienceId,
        status: "worldlabs_generation_requested",
        model: input.model ?? "default",
        input_media_asset_ids: input.mediaAssetIds,
        world_prompt_payload: { prompt: input.prompt },
      })
      .select("id")
      .single();

    if (error) throw error;

    await supabase
      .from("experiences")
      .update({ status: "processing", updated_at: new Date().toISOString() })
      .eq("id", input.experienceId);

    return {
      engine: this.type,
      status: "processing",
      jobId: job.id,
    };
  }
}

/** SpAItial Echo — image → immersive 3D world (branded "Immersive World" in UI). */
class ImmersiveWorldEngine implements SpatialEngine {
  type: ExperienceType = "immersive_world";

  async generate(input: SpatialGenerationInput): Promise<SpatialGenerationResult> {
    const supabase = createAdminClient();

    const { data: job, error } = await supabase
      .from("worldlabs_jobs")
      .insert({
        organization_id: input.organizationId,
        property_id: input.propertyId,
        experience_id: input.experienceId,
        status: "worldlabs_generation_requested",
        model: input.model ?? null,
        provider: "spaitial",
        input_media_asset_ids: input.mediaAssetIds,
        world_prompt_payload: { prompt: input.prompt, title: input.prompt },
      })
      .select("id")
      .single();

    if (error) throw error;

    await supabase
      .from("experiences")
      .update({ status: "processing", updated_at: new Date().toISOString() })
      .eq("id", input.experienceId);

    return { engine: this.type, status: "processing", jobId: job.id };
  }
}

class MobileCaptureEngine implements SpatialEngine {
  type: ExperienceType = "mobile_360_capture";

  async generate(input: SpatialGenerationInput): Promise<SpatialGenerationResult> {
    const supabase = createAdminClient();
    await supabase
      .from("experiences")
      .update({ status: "draft", updated_at: new Date().toISOString() })
      .eq("id", input.experienceId);
    return { engine: this.type, status: "draft" };
  }
}

/** Scene Intelligence — flat images with motion; no external generation pipeline. */
class SceneIntelligenceEngine implements SpatialEngine {
  type: ExperienceType = "scene_intelligence";

  async generate(input: SpatialGenerationInput): Promise<SpatialGenerationResult> {
    const supabase = createAdminClient();
    await supabase
      .from("experiences")
      .update({ status: "ready_for_review", updated_at: new Date().toISOString() })
      .eq("id", input.experienceId);
    return { engine: this.type, status: "ready_for_review" };
  }
}

/** AI Cinematic Walkthrough — image upload + enhancement + scroll viewer pipeline. */
class CinematicWalkthroughEngine implements SpatialEngine {
  type: ExperienceType = "cinematic_walkthrough";

  async generate(input: SpatialGenerationInput): Promise<SpatialGenerationResult> {
    const supabase = createAdminClient();
    await supabase.from("walkthrough_checklists").upsert({ experience_id: input.experienceId }, { onConflict: "experience_id" });
    await supabase
      .from("experiences")
      .update({ status: "draft", updated_at: new Date().toISOString() })
      .eq("id", input.experienceId);
    return { engine: this.type, status: "draft" };
  }
}

/** Image Walkthrough — flat photo / panorama node graph with hotspots and annotations. */
class ImageWalkthroughEngine implements SpatialEngine {
  type: ExperienceType = "image_walkthrough";

  async generate(input: SpatialGenerationInput): Promise<SpatialGenerationResult> {
    const supabase = createAdminClient();
    await supabase.from("image_walkthrough_checklists").upsert({ experience_id: input.experienceId }, { onConflict: "experience_id" });
    await supabase.from("image_walkthrough_settings").upsert({ experience_id: input.experienceId }, { onConflict: "experience_id" });
    await supabase
      .from("experiences")
      .update({ status: "draft", updated_at: new Date().toISOString() })
      .eq("id", input.experienceId);
    return { engine: this.type, status: "draft" };
  }
}

export class SpatialGenerationService {
  private engines: Record<ExperienceType, SpatialEngine> = {
    "360_realistic": new Tour360Engine(),
    worldlabs_splat: new WorldLabsEngine(),
    immersive_world: new ImmersiveWorldEngine(),
    mobile_360_capture: new MobileCaptureEngine(),
    scene_intelligence: new SceneIntelligenceEngine(),
    cinematic_walkthrough: new CinematicWalkthroughEngine(),
    image_walkthrough: new ImageWalkthroughEngine(),
  };

  getEngine(type: ExperienceType): SpatialEngine {
    return this.engines[type];
  }

  async generate(type: ExperienceType, input: SpatialGenerationInput) {
    return this.getEngine(type).generate(input);
  }

  async processWorldLabsJob(jobId: string) {
    const supabase = createAdminClient();
    const { data: job } = await supabase.from("worldlabs_jobs").select("*").eq("id", jobId).single();
    if (!job) throw new Error("Job not found");

    const updateStatus = async (status: string, extra?: Record<string, unknown>) => {
      await supabase.from("worldlabs_jobs").update({ status, ...extra, updated_at: new Date().toISOString() }).eq("id", jobId);
    };

    try {
      await updateStatus("worldlabs_processing", { started_at: new Date().toISOString() });

      const mediaIds = (job.input_media_asset_ids as string[]) ?? [];
      const worldLabsIds = await resolveWorldLabsMediaIds(mediaIds);
      const prompt = (job.world_prompt_payload as { prompt?: string })?.prompt;

      if (mediaIds.length && !worldLabsIds.length) {
        throw new Error("No World Labs media_asset_id found. Re-upload images for 3D generation.");
      }

      const { operationId, operation } = await worldLabsService.generateWorld({
        mediaAssetIds: worldLabsIds.length ? worldLabsIds : undefined,
        prompt,
        model: job.model ?? undefined,
      });

      await updateStatus("worldlabs_processing", { operation_id: operationId });

      const completed = operation.done
        ? operation
        : await worldLabsService.pollUntilDone(operationId);

      if (completed.error) {
        await updateStatus("worldlabs_generation_failed", {
          error_message: completed.error.message,
          failed_at: new Date().toISOString(),
        });
        return;
      }

      const world = completed.response!;
      const assets = worldLabsService.extractSplatUrls(world);

      await updateStatus("worldlabs_succeeded", {
        world_id: assets.worldId,
        raw_world_response: world,
        raw_operation_response: completed,
      });

      await supabase.from("splat_worlds").upsert({
        property_id: job.property_id,
        experience_id: job.experience_id,
        worldlabs_job_id: jobId,
        world_id: assets.worldId,
        world_marble_url: assets.worldMarbleUrl,
        thumbnail_url: assets.thumbnailUrl,
        caption: assets.caption,
        spz_100k_url: assets.spz100kUrl,
        spz_500k_url: assets.spz500kUrl,
        spz_full_res_url: assets.spzFullResUrl,
        collider_mesh_url: assets.colliderMeshUrl,
        pano_url: assets.panoUrl,
        model: job.model,
        provider: "worldlabs",
      });

      await updateStatus("ready_for_review", { completed_at: new Date().toISOString() });
      await supabase
        .from("experiences")
        .update({ status: "ready_for_review", updated_at: new Date().toISOString() })
        .eq("id", job.experience_id);
    } catch (err) {
      await updateStatus("worldlabs_generation_failed", {
        error_message: err instanceof Error ? err.message : "Unknown error",
        failed_at: new Date().toISOString(),
        retry_count: (job.retry_count ?? 0) + 1,
      });
      await supabase
        .from("experiences")
        .update({ status: "failed", updated_at: new Date().toISOString() })
        .eq("id", job.experience_id);
    }
  }

  async processImmersiveWorldJob(jobId: string) {
    const supabase = createAdminClient();
    const { data: job } = await supabase.from("worldlabs_jobs").select("*").eq("id", jobId).single();
    if (!job) throw new Error("Job not found");

    const updateStatus = async (status: string, extra?: Record<string, unknown>) => {
      await supabase.from("worldlabs_jobs").update({ status, ...extra, updated_at: new Date().toISOString() }).eq("id", jobId);
    };

    const fail = async (message: string) => {
      await updateStatus("worldlabs_generation_failed", {
        error_message: message,
        failed_at: new Date().toISOString(),
        retry_count: (job.retry_count ?? 0) + 1,
      });
      await supabase
        .from("experiences")
        .update({ status: "failed", updated_at: new Date().toISOString() })
        .eq("id", job.experience_id);
    };

    try {
      const requestId = job.operation_id as string | null;

      // Phase 1: submit to SpAItial (fast — safe on Vercel)
      if (!requestId) {
        await updateStatus("worldlabs_processing", { started_at: new Date().toISOString(), provider: "spaitial" });

        const mediaIds = (job.input_media_asset_ids as string[]) ?? [];
        const promptPayload = (job.world_prompt_payload as { prompt?: string; title?: string }) ?? {};
        let imageUrl: string | undefined;

        if (mediaIds.length) {
          const { data: assets } = await supabase.from("media_assets").select("file_url").in("id", mediaIds).limit(1);
          imageUrl = assets?.[0]?.file_url;
        }

        if (!imageUrl && !promptPayload.prompt) {
          await fail("Upload a property image to generate an Immersive World.");
          return;
        }

        const title = promptPayload.title ?? promptPayload.prompt ?? "Property immersive world";
        const model = job.model && job.model !== "default" ? job.model : undefined;

        const { requestId: newRequestId } = imageUrl
          ? await spaitialService.createWorldFromMediaUrl({ imageUrl, title, model })
          : await spaitialService.createWorldFromText({ prompt: promptPayload.prompt!, title, model });

        await updateStatus("worldlabs_processing", { operation_id: newRequestId });
        return;
      }

      // Phase 2: poll once per invocation (cron / queue calls repeatedly)
      const poll = await spaitialService.getStatus(requestId);

      if (!spaitialService.isTerminal(poll.status)) return;

      if (poll.status === "FAILED" || poll.status === "CANCELLED") {
        await fail(poll.error ?? `Generation ${poll.status}`);
        return;
      }

      const result = await spaitialService.getResult(requestId);
      let spzPublicUrl = result.splatProxyUrl;

      try {
        const signedUrl = await spaitialService.resolveSplatDownloadUrl(requestId);
        const fileRes = await fetch(signedUrl);
        if (fileRes.ok) {
          const buffer = await fileRes.arrayBuffer();
          const path = `${job.organization_id}/${job.property_id}/immersive/${job.experience_id}-${Date.now()}.spz`;
          await supabase.storage.from("media").upload(path, buffer, { contentType: "application/octet-stream", upsert: true });
          const { data: { publicUrl } } = supabase.storage.from("media").getPublicUrl(path);
          spzPublicUrl = publicUrl;
        }
      } catch {
        // Fall back to SpAItial proxy URL
      }

      await updateStatus("worldlabs_succeeded", {
        world_id: result.worldId,
        raw_world_response: result,
        completed_at: new Date().toISOString(),
      });

      await supabase.from("splat_worlds").upsert({
        property_id: job.property_id,
        experience_id: job.experience_id,
        worldlabs_job_id: jobId,
        world_id: result.worldId,
        thumbnail_url: result.thumbnailUrl,
        caption: result.title,
        spz_full_res_url: spzPublicUrl,
        spz_500k_url: spzPublicUrl,
        pano_url: result.panoramaProxyUrl,
        viewer_url: result.viewerUrl,
        splat_format: result.splatFormat ?? "spz",
        model: job.model,
        provider: "spaitial",
      });

      await updateStatus("ready_for_review", { completed_at: new Date().toISOString() });
      await supabase
        .from("experiences")
        .update({ status: "ready_for_review", updated_at: new Date().toISOString() })
        .eq("id", job.experience_id);
    } catch (err) {
      await fail(err instanceof Error ? err.message : "Unknown error");
    }
  }

  /** Route to the correct 3D provider processor. */
  async processSpatialJob(jobId: string) {
    const supabase = createAdminClient();
    const { data: job } = await supabase.from("worldlabs_jobs").select("provider").eq("id", jobId).single();
    if (job?.provider === "spaitial") return this.processImmersiveWorldJob(jobId);
    return this.processWorldLabsJob(jobId);
  }
}

async function resolveWorldLabsMediaIds(supabaseAssetIds: string[]): Promise<string[]> {
  if (!supabaseAssetIds.length) return [];
  const supabase = createAdminClient();
  const { data: assets } = await supabase
    .from("media_assets")
    .select("worldlabs_media_asset_id")
    .in("id", supabaseAssetIds);
  return (assets ?? [])
    .map((a) => a.worldlabs_media_asset_id)
    .filter((id): id is string => Boolean(id));
}

export const spatialGenerationService = new SpatialGenerationService();
