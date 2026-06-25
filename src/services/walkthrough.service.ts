import { aspectRatioFromDimensions, fetchImageDimensions, parseImageDimensions } from "@/lib/image-dimensions";
import { createAdminClient } from "@/lib/supabase/admin";
import { logApiUsage } from "@/lib/api-usage-logger";
import { embeddingService } from "./embedding.service";
import { vertexAIService, ENHANCEMENT_PROMPT, VERTEX_IMAGE_MODEL, VERTEX_PLANNER_MODEL } from "./vertex-ai.service";
import { getVertexAIConfig } from "@/lib/platform-settings";
import { resolveVeoModelId, assertAllowedVeoModel, DEFAULT_VEO_GENERATION_MODE, type VeoGenerationMode } from "@/lib/veo-video-models";
import { planWalkthroughScenes } from "./walkthrough-ai-orchestrator";
import type { WalkthroughChecklist, WalkthroughImage, WalkthroughScene } from "@/types/cinematic-walkthrough";
import { v4 as uuidv4 } from "uuid";
import { VIDEO_WALKTHROUGH_ANNOTATIONS_ENABLED } from "@/lib/walkthrough-video-features";
import { seedPropertyKnowledgeFromProperty } from "./property-knowledge.service";
import {
  kickVideoPollCycle,
  processExperienceVideoJobs,
  processVideoJob,
} from "@/lib/walkthrough-pipeline/veo-job-runner";
import { runWithWorkerPool } from "@/lib/walkthrough-pipeline/worker-pool";
import { VEO_PIPELINE } from "@/lib/walkthrough-pipeline/config";

const MAX_IMAGES = 35;
const MAX_WALKTHROUGH_IMAGE_BYTES = 50 * 1024 * 1024;
const WALKTHROUGH_IMAGE_TYPES = new Set(["image/jpeg", "image/png", "image/webp", "image/jpg"]);

export function validateWalkthroughImageInput(file: { size: number; type: string; name: string }) {
  if (file.size > MAX_WALKTHROUGH_IMAGE_BYTES) {
    throw new Error(`File too large (${file.name}). Max ${MAX_WALKTHROUGH_IMAGE_BYTES / 1024 / 1024}MB`);
  }
  const mime = file.type || "image/jpeg";
  if (!WALKTHROUGH_IMAGE_TYPES.has(mime)) {
    throw new Error(`Unsupported type for ${file.name}: ${mime || "unknown"}. Use JPG, PNG, or WebP.`);
  }
}

function walkthroughImageExtension(mimeType: string, fileName: string) {
  if (mimeType.includes("png")) return "png";
  if (mimeType.includes("webp")) return "webp";
  const fromName = fileName.split(".").pop()?.toLowerCase();
  if (fromName === "png" || fromName === "webp" || fromName === "jpg" || fromName === "jpeg") return fromName === "jpeg" ? "jpg" : fromName;
  return "jpg";
}

export async function uploadWalkthroughImage(params: {
  buffer: ArrayBuffer;
  fileName: string;
  mimeType: string;
  fileSize: number;
  experienceId: string;
  propertyId: string;
  organizationId: string;
  projectId?: string | null;
  uploadedBy?: string;
  sortOrder: number;
}): Promise<WalkthroughImage> {
  validateWalkthroughImageInput({ size: params.fileSize, type: params.mimeType, name: params.fileName });

  const admin = createAdminClient();
  const imageId = uuidv4();
  const ext = walkthroughImageExtension(params.mimeType, params.fileName);
  const storagePath = `${params.organizationId}/${params.propertyId}/walkthrough/images/${imageId}.${ext}`;

  const { error: uploadError } = await admin.storage.from("media").upload(storagePath, params.buffer, {
    contentType: params.mimeType,
    upsert: false,
  });
  if (uploadError) throw new Error(uploadError.message);

  const { data: { publicUrl } } = admin.storage.from("media").getPublicUrl(storagePath);
  const dims = parseImageDimensions(params.buffer, params.mimeType);

  await ensureWalkthroughChecklist(params.experienceId);

  const { data, error } = await admin.from("walkthrough_images").insert({
    id: imageId,
    experience_id: params.experienceId,
    property_id: params.propertyId,
    organization_id: params.organizationId,
    project_id: params.projectId ?? null,
    original_image_url: publicUrl,
    thumbnail_url: publicUrl,
    file_name: params.fileName,
    file_size: params.fileSize,
    mime_type: params.mimeType,
    width: dims?.width ?? null,
    height: dims?.height ?? null,
    upload_status: "ready",
    enhancement_status: "pending",
    sort_order: params.sortOrder,
    uploaded_by: params.uploadedBy ?? null,
  }).select().single();

  if (error) {
    await admin.storage.from("media").remove([storagePath]).catch(() => {});
    throw new Error(error.message);
  }

  await refreshWalkthroughChecklist(params.experienceId);
  return data as WalkthroughImage;
}

export async function countWalkthroughImages(experienceId: string) {
  const admin = createAdminClient();
  const { count } = await admin
    .from("walkthrough_images")
    .select("*", { count: "exact", head: true })
    .eq("experience_id", experienceId);
  return count ?? 0;
}

async function resolveSceneAspectRatio(sceneId: string, imageUrl?: string | null): Promise<"16:9" | "9:16"> {
  const admin = createAdminClient();
  const { data: scene } = await admin
    .from("walkthrough_scenes")
    .select("image_id")
    .eq("id", sceneId)
    .single();

  if (scene?.image_id) {
    const { data: img } = await admin
      .from("walkthrough_images")
      .select("width, height")
      .eq("id", scene.image_id)
      .single();
    if (img?.width && img?.height) return aspectRatioFromDimensions(img.width, img.height);
  }

  if (imageUrl) {
    const dims = await fetchImageDimensions(imageUrl);
    if (dims) return aspectRatioFromDimensions(dims.width, dims.height);
  }

  return "16:9";
}

function applyStoredVideoUrls(aspectRatio: "16:9" | "9:16", storedUrl: string) {
  if (aspectRatio === "9:16") {
    return {
      video_url: storedUrl,
      video_url_720p: storedUrl,
      video_url_1080p: storedUrl,
      video_url_mobile: storedUrl,
    };
  }
  return {
    video_url: storedUrl,
    video_url_720p: storedUrl,
    video_url_1080p: storedUrl,
    video_url_mobile: storedUrl,
  };
}

function applyJobStoredVideoUrls(storedUrl: string) {
  return {
    stored_video_url: storedUrl,
    video_url_720p: storedUrl,
    video_url_1080p: storedUrl,
    video_url_mobile: storedUrl,
  };
}

export async function ensureWalkthroughChecklist(experienceId: string): Promise<WalkthroughChecklist> {
  const admin = createAdminClient();
  const { data } = await admin
    .from("walkthrough_checklists")
    .select("*")
    .eq("experience_id", experienceId)
    .maybeSingle();

  if (data) return data as WalkthroughChecklist;

  const { data: created } = await admin
    .from("walkthrough_checklists")
    .insert({ experience_id: experienceId })
    .select()
    .single();

  return created as WalkthroughChecklist;
}

export async function refreshWalkthroughChecklist(experienceId: string) {
  const admin = createAdminClient();
  const { data: existingChecklist } = await admin
    .from("walkthrough_checklists")
    .select("ai_tested, viewer_previewed")
    .eq("experience_id", experienceId)
    .maybeSingle();

  const [{ count: imageCount }, { count: enhancedCount }, { count: sceneCount }, { count: motionCount }, { count: annCount }, { count: ragCount }] = await Promise.all([
    admin.from("walkthrough_images").select("*", { count: "exact", head: true }).eq("experience_id", experienceId),
    admin.from("walkthrough_images").select("*", { count: "exact", head: true }).eq("experience_id", experienceId).in("enhancement_status", ["approved", "completed", "skipped"]),
    admin.from("walkthrough_scenes").select("*", { count: "exact", head: true }).eq("experience_id", experienceId),
    admin.from("walkthrough_scenes").select("*", { count: "exact", head: true }).eq("experience_id", experienceId).not("video_url", "is", null),
    admin.from("walkthrough_annotations").select("*", { count: "exact", head: true }).eq("experience_id", experienceId),
    admin.from("knowledge_entries").select("*", { count: "exact", head: true }).eq("property_id", (
      await admin.from("experiences").select("property_id").eq("id", experienceId).single()
    ).data?.property_id ?? "00000000-0000-0000-0000-000000000000"),
  ]);

  const { data: exp } = await admin.from("experiences").select("status").eq("id", experienceId).single();
  const warnings: string[] = [];
  const hasMotionVideos = (sceneCount ?? 0) > 0 && (motionCount ?? 0) > 0;
  const allMotionReady = (sceneCount ?? 0) > 0 && (motionCount ?? 0) >= (sceneCount ?? 0);
  if ((sceneCount ?? 0) > 0 && !allMotionReady) {
    warnings.push(`Veo motion: ${motionCount ?? 0}/${sceneCount ?? 0} scenes have video clips`);
  }

  const checklist = {
    images_uploaded: (imageCount ?? 0) > 0,
    images_enhanced: (imageCount ?? 0) > 0 && (enhancedCount ?? 0) >= (imageCount ?? 0),
    scenes_created: (sceneCount ?? 0) > 0,
    scene_order_approved: (sceneCount ?? 0) > 0,
    motion_added: allMotionReady,
    motion_videos_generated: allMotionReady,
    annotations_added: (annCount ?? 0) > 0,
    property_rag_added: (ragCount ?? 0) >= 1,
    ai_tested: existingChecklist?.ai_tested ?? false,
    viewer_previewed: existingChecklist?.viewer_previewed ?? false,
    ready_to_publish:
      (imageCount ?? 0) > 0 &&
      (sceneCount ?? 0) > 0 &&
      exp?.status !== "published",
    warnings,
    updated_at: new Date().toISOString(),
  };

  await admin.from("walkthrough_checklists").upsert({ experience_id: experienceId, ...checklist });
  return { experience_id: experienceId, ...checklist };
}

export async function runImageEnhancement(imageId: string) {
  const admin = createAdminClient();
  const { data: image, error } = await admin.from("walkthrough_images").select("*").eq("id", imageId).single();
  if (error || !image) throw new Error("Image not found");

  const vertexCfg = await getVertexAIConfig();
  const enhanceModel = vertexCfg.image_model ?? VERTEX_IMAGE_MODEL;

  const { data: job } = await admin.from("walkthrough_enhancement_jobs").insert({
    image_id: imageId,
    status: "processing",
    model: enhanceModel,
    prompt: ENHANCEMENT_PROMPT,
    started_at: new Date().toISOString(),
  }).select().single();

  await admin.from("walkthrough_images").update({ enhancement_status: "processing" }).eq("id", imageId);

  try {
    const { buffer, mimeType, model, prompt } = await vertexAIService.enhanceImage(image.original_image_url);
    const enhancedUrl = await vertexAIService.uploadImageBuffer(
      buffer,
      mimeType,
      image.organization_id,
      image.property_id,
      imageId.slice(0, 8),
    );

    await admin.from("walkthrough_images").update({
      enhanced_image_url: enhancedUrl,
      thumbnail_url: enhancedUrl,
      mobile_crop_url: enhancedUrl,
      desktop_crop_url: enhancedUrl,
      enhancement_status: "approved",
      approved_by_user: true,
      enhancement_model: model,
      enhancement_prompt: prompt,
      enhancement_error: null,
      updated_at: new Date().toISOString(),
    }).eq("id", imageId);

    await admin.from("walkthrough_enhancement_jobs").update({
      status: "completed",
      result_url: enhancedUrl,
      completed_at: new Date().toISOString(),
    }).eq("id", job!.id);

    await refreshWalkthroughChecklist(image.experience_id);
    await logApiUsage({
      provider: "vertex",
      operation: "image_enhance",
      model,
      organizationId: image.organization_id,
      experienceId: image.experience_id,
      status: "success",
    });
    return enhancedUrl;
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Enhancement failed";
    await logApiUsage({
      provider: "vertex",
      operation: "image_enhance",
      organizationId: image.organization_id,
      experienceId: image.experience_id,
      status: "failed",
      metadata: { error: msg },
    });
    await admin.from("walkthrough_images").update({
      enhancement_status: "failed",
      enhancement_error: msg,
      enhanced_image_url: image.original_image_url,
      thumbnail_url: image.original_image_url,
    }).eq("id", imageId);
    await admin.from("walkthrough_enhancement_jobs").update({
      status: "failed",
      error: msg,
      completed_at: new Date().toISOString(),
    }).eq("id", job!.id);
    throw err;
  }
}

export async function planAndCreateScenes(experienceId: string) {
  const admin = createAdminClient();
  const { data: images } = await admin
    .from("walkthrough_images")
    .select("*")
    .eq("experience_id", experienceId)
    .eq("included", true)
    .order("sort_order");

  if (!images?.length) throw new Error("Upload images first");

  const { data: exp } = await admin
    .from("experiences")
    .select("property_id, organization_id, properties(name, property_type)")
    .eq("id", experienceId)
    .single();
  if (!exp) throw new Error("Experience not found");

  const property = exp.properties as { name?: string; property_type?: string } | null;
  const imageInputs = images.map((img) => ({
    id: img.id,
    url: img.enhanced_image_url ?? img.original_image_url,
    file_name: img.file_name,
  }));

  const { plan, plans, flow_warnings, provider } = await planWalkthroughScenes(imageInputs, {
    propertyType: property?.property_type ?? "residential",
    propertyName: property?.name,
  });

  await logApiUsage({
    provider: provider === "fallback" ? "internal" : "vertex",
    operation: "plan_scenes",
    organizationId: exp.organization_id,
    experienceId,
    status: provider === "fallback" ? "failed" : "success",
    metadata: { scene_count: plans.length, property_type: property?.property_type },
  });

  const vertexCfg = await getVertexAIConfig();
  await admin.from("walkthrough_plans").upsert({
    experience_id: experienceId,
    property_id: exp.property_id,
    organization_id: exp.organization_id,
    tour_title: plan.tour_title,
    property_type: plan.property_type,
    flow_warnings: plan.flow_warnings,
    plan_json: plan,
    model: vertexCfg.planner_model ?? VERTEX_PLANNER_MODEL,
    updated_at: new Date().toISOString(),
  }, { onConflict: "experience_id" });

  await admin.from("walkthrough_scenes").delete().eq("experience_id", experienceId);

  const sorted = [...plans].sort((a, b) => a.suggested_order - b.suggested_order);
  const scenes: WalkthroughScene[] = [];
  const usedImageIds = new Set<string>();

  for (let i = 0; i < sorted.length; i++) {
    const plan = sorted[i];
    if (!plan.include) continue;

    let img = images.find((im) => im.id === plan.image_id && !usedImageIds.has(im.id));
    if (!img) {
      img = images.find((im) => !usedImageIds.has(im.id));
    }
    if (!img) continue;
    usedImageIds.add(img.id);

    const imageUrl = img.enhanced_image_url ?? img.original_image_url;

    const { data: scene } = await admin.from("walkthrough_scenes").insert({
      experience_id: experienceId,
      property_id: exp.property_id,
      organization_id: exp.organization_id,
      image_id: img.id,
      title: plan.title,
      description: plan.description,
      room_type: plan.room_type,
      caption: plan.caption,
      image_url: imageUrl,
      thumbnail_url: img.thumbnail_url ?? imageUrl,
      poster_url: img.thumbnail_url ?? imageUrl,
      scene_order: i,
      is_start_scene: i === 0,
      motion_type: plan.suggested_motion,
      veo_prompt: plan.veo_prompt,
      ai_context: `${plan.description}. ${plan.caption}`,
      quality_notes: plan.classification_reason ?? plan.quality_notes,
      warnings: plan.needs_review ? [...(plan.warnings ?? []), "needs_review"] : plan.warnings,
      edit_config: {
        classification_confidence: plan.classification_confidence,
        classification_reason: plan.classification_reason,
        needs_review: plan.needs_review,
        included: true,
      },
      scene_status: plan.needs_review ? "needs_review" : "planned",
      duration: plan.duration ?? 6,
      timeline_start: i * (plan.duration ?? 6),
      timeline_end: (i + 1) * (plan.duration ?? 6),
    }).select().single();

    if (scene) {
      scenes.push(scene as WalkthroughScene);
      await admin.from("walkthrough_images").update({
        ai_analysis: plan,
        room_type: plan.room_type,
        ai_caption: plan.caption,
        ai_description: plan.description,
      }).eq("id", img.id);

      for (const ann of VIDEO_WALKTHROUGH_ANNOTATIONS_ENABLED ? plan.suggested_annotations.slice(0, 8) : []) {
        await admin.from("walkthrough_annotations").insert({
          scene_id: scene.id,
          property_id: exp.property_id,
          experience_id: experienceId,
          title: ann.title,
          short_description: ann.title,
          category: ann.category ?? "room_feature",
          x_position: ann.x,
          y_position: ann.y,
          rag_enabled: true,
        });
      }

      try {
        await syncWalkthroughSceneToRAG(scene as WalkthroughScene, img.organization_id);
      } catch {
        // RAG sync should not block scene creation
      }
    }
  }

  // Create scenes for any uploaded images the planner skipped
  for (const img of images) {
    if (usedImageIds.has(img.id)) continue;
    const imageUrl = img.enhanced_image_url ?? img.original_image_url;
    const order = scenes.length;

    const { data: scene } = await admin.from("walkthrough_scenes").insert({
      experience_id: experienceId,
      property_id: exp.property_id,
      organization_id: exp.organization_id,
      image_id: img.id,
      title: img.file_name.replace(/\.[^.]+$/, "").replace(/[_-]+/g, " ") || `Scene ${order + 1}`,
      description: "Additional property scene",
      room_type: "room",
      caption: `Scene ${order + 1}`,
      image_url: imageUrl,
      thumbnail_url: img.thumbnail_url ?? imageUrl,
      poster_url: img.thumbnail_url ?? imageUrl,
      scene_order: order,
      is_start_scene: order === 0,
      motion_type: "push_in",
      veo_prompt: `Create a premium real-estate walkthrough motion from this room image. Slow forward dolly with subtle parallax. Preserve exact layout and architecture. No people.`,
      ai_context: `Scene ${order + 1}`,
      duration: 6,
      timeline_start: order * 6,
      timeline_end: (order + 1) * 6,
      scene_status: "planned",
    }).select().single();

    if (scene) {
      scenes.push(scene as WalkthroughScene);
      usedImageIds.add(img.id);
    }
  }

  const { data: checklist } = await admin.from("walkthrough_checklists").upsert({
    experience_id: experienceId,
    scenes_created: scenes.length > 0,
    scene_order_approved: scenes.length > 0,
    motion_added: scenes.length > 0,
    warnings: flow_warnings,
    updated_at: new Date().toISOString(),
  }, { onConflict: "experience_id" }).select().single();

  try {
    await seedPropertyKnowledgeFromProperty(exp.property_id, exp.organization_id);
  } catch {
    // Knowledge seeding should not block scene planning
  }

  await refreshWalkthroughChecklist(experienceId);
  return { scenes, flow_warnings, checklist };
}

export async function syncWalkthroughSceneToRAG(
  scene: { id: string; property_id: string; title: string; description?: string | null; ai_context?: string | null; caption?: string | null },
  organizationId: string,
) {
  const admin = createAdminClient();
  const content = scene.ai_context || scene.description || scene.caption || `Scene: ${scene.title}`;

  const { data: existing } = await admin
    .from("knowledge_entries")
    .select("id")
    .eq("source_id", scene.id)
    .eq("source_type", "walkthrough_scene")
    .maybeSingle();

  const entry = {
    organization_id: organizationId,
    property_id: scene.property_id,
    walkthrough_scene_id: scene.id,
    category: "room_context",
    title: scene.title,
    content,
    source_type: "walkthrough_scene",
    source_id: scene.id,
    approved: true,
  };

  let entryId: string;
  if (existing) {
    const { data } = await admin.from("knowledge_entries").update({ ...entry, updated_at: new Date().toISOString() }).eq("id", existing.id).select("id").single();
    entryId = data!.id;
  } else {
    const { data } = await admin.from("knowledge_entries").insert(entry).select("id").single();
    entryId = data!.id;
  }

  const embedding = await embeddingService.embed(content);
  await admin.from("knowledge_embeddings").upsert({ knowledge_entry_id: entryId, embedding }, { onConflict: "knowledge_entry_id" });
}

export async function syncWalkthroughAnnotationToRAG(
  ann: { id: string; property_id: string; scene_id: string; title: string; description?: string | null; short_description?: string | null; ai_context?: string | null },
  organizationId: string,
  sceneTitle: string,
) {
  const admin = createAdminClient();
  const content = [`Scene: ${sceneTitle}`, `Object: ${ann.title}`, ann.short_description, ann.description, ann.ai_context].filter(Boolean).join(". ");

  const { data: existing } = await admin
    .from("knowledge_entries")
    .select("id")
    .eq("source_id", ann.id)
    .eq("source_type", "walkthrough_annotation")
    .maybeSingle();

  const entry = {
    organization_id: organizationId,
    property_id: ann.property_id,
    walkthrough_scene_id: ann.scene_id,
    walkthrough_annotation_id: ann.id,
    category: "room_context",
    title: ann.title,
    content,
    source_type: "walkthrough_annotation",
    source_id: ann.id,
    approved: true,
  };

  let entryId: string;
  if (existing) {
    const { data } = await admin.from("knowledge_entries").update({ ...entry, updated_at: new Date().toISOString() }).eq("id", existing.id).select("id").single();
    entryId = data!.id;
  } else {
    const { data } = await admin.from("knowledge_entries").insert(entry).select("id").single();
    entryId = data!.id;
  }

  const embedding = await embeddingService.embed(content);
  await admin.from("knowledge_embeddings").upsert({ knowledge_entry_id: entryId, embedding }, { onConflict: "knowledge_entry_id" });
  await admin.from("walkthrough_annotations").update({ rag_entry_id: entryId }).eq("id", ann.id);
  return entryId;
}

export async function saveRagEntriesFromChat(
  propertyId: string,
  organizationId: string,
  entries: { category: string; title: string; content: string }[],
  createdBy?: string,
) {
  const admin = createAdminClient();
  const saved = [];

  for (const e of entries) {
    if (!e.content?.trim()) continue;
    const { data } = await admin.from("knowledge_entries").insert({
      property_id: propertyId,
      organization_id: organizationId,
      category: e.category,
      title: e.title,
      content: e.content,
      approved: true,
      created_by: createdBy,
      source_type: "walkthrough_chat",
    }).select().single();

    if (data) {
      const embedding = await embeddingService.embed(`${e.title}\n${e.content}`);
      await admin.from("knowledge_embeddings").upsert({ knowledge_entry_id: data.id, embedding }, { onConflict: "knowledge_entry_id" });
      saved.push(data);
    }
  }
  return saved;
}

export async function queueSceneVideoJob(
  sceneId: string,
  options?: { force?: boolean; videoMode?: VeoGenerationMode },
) {
  const admin = createAdminClient();
  const { data: scene, error } = await admin
    .from("walkthrough_scenes")
    .select("*, experiences(organization_id)")
    .eq("id", sceneId)
    .single();
  if (error || !scene) throw new Error("Scene not found");
  if (scene.video_url && !options?.force) return { sceneId, status: "completed" as const, video_url: scene.video_url };

  if (options?.force) {
    await admin.from("walkthrough_scenes").update({
      video_url: null,
      video_url_720p: null,
      video_url_1080p: null,
      video_url_mobile: null,
      scene_status: "draft",
    }).eq("id", sceneId);
    await admin.from("walkthrough_video_jobs").update({ status: "failed", error: "superseded by regenerate" })
      .eq("scene_id", sceneId)
      .in("status", ["queued", "submitted", "processing"]);
  }

  const prompt = scene.veo_prompt ?? `Create a premium real-estate walkthrough motion from this ${scene.room_type ?? "room"} image. Slow forward dolly with subtle parallax. Preserve exact layout and architecture. No people.`;
  const orgId = scene.organization_id ?? (scene.experiences as { organization_id?: string })?.organization_id;
  const aspectRatio = await resolveSceneAspectRatio(sceneId, scene.image_url);

  const { data: existing } = await admin
    .from("walkthrough_video_jobs")
    .select("id, status, polling_url")
    .eq("scene_id", sceneId)
    .in("status", ["queued", "submitted", "processing"])
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (existing) {
    return { sceneId, jobId: existing.id, status: existing.status as "queued" | "submitted" | "processing" };
  }

  const videoMode = options?.videoMode ?? DEFAULT_VEO_GENERATION_MODE;
  const videoModel = resolveVeoModelId(videoMode);
  assertAllowedVeoModel(videoModel);

  const { data: job } = await admin.from("walkthrough_video_jobs").insert({
    scene_id: sceneId,
    experience_id: scene.experience_id,
    property_id: scene.property_id,
    organization_id: orgId,
    status: "queued",
    model: videoModel,
    prompt,
    aspect_ratio: aspectRatio,
    started_at: new Date().toISOString(),
  }).select().single();

  await admin.from("walkthrough_scenes").update({ scene_status: "motion_processing" }).eq("id", sceneId);

  return { sceneId, jobId: job!.id, experienceId: scene.experience_id, status: "queued" as const };
}

async function ensureVideoJobSubmitted(jobId: string) {
  const admin = createAdminClient();
  const { data: job, error } = await admin
    .from("walkthrough_video_jobs")
    .select("*")
    .eq("id", jobId)
    .single();
  if (error || !job) throw new Error("Video job not found");
  if (job.polling_url) return job;

  const { data: sceneRow } = await admin.from("walkthrough_scenes").select("image_url").eq("id", job.scene_id).single();
  const imageUrl = sceneRow?.image_url;
  const aspectRatio = (job.aspect_ratio as "16:9" | "9:16" | null)
    ?? await resolveSceneAspectRatio(job.scene_id, imageUrl);
  const { operationName, model: submittedModel } = await vertexAIService.submitVideoJob(job.prompt, {
    aspectRatio,
    model: job.model,
  }, imageUrl);
  await logApiUsage({
    provider: "vertex",
    operation: "video_generate",
    model: submittedModel ?? job.model,
    organizationId: job.organization_id,
    experienceId: job.experience_id,
    status: "queued",
    metadata: { scene_id: job.scene_id, operation: operationName },
  });
  const { data: updated } = await admin.from("walkthrough_video_jobs").update({
    openrouter_job_id: operationName,
    polling_url: `vertex://${operationName}`,
    status: "processing",
    model: submittedModel ?? job.model,
  }).eq("id", jobId).select().single();
  return updated ?? job;
}

async function storeVideoBuffer(
  buffer: Buffer,
  organizationId: string,
  propertyId: string,
  sceneId: string,
  contentType = "video/mp4",
): Promise<string> {
  const ext = contentType.includes("webm") ? "webm" : "mp4";
  const path = `${organizationId}/${propertyId}/walkthrough/motion-${sceneId.slice(0, 8)}-${Date.now()}.${ext}`;
  const admin = createAdminClient();
  const { error } = await admin.storage.from("media").upload(path, buffer, { contentType, upsert: true });
  if (error) throw error;
  const { data: { publicUrl } } = admin.storage.from("media").getPublicUrl(path);
  return publicUrl;
}

/** @deprecated Use queueSceneVideoJob — submit happens on poll to keep API under 1s */
export async function submitSceneVideoJob(sceneId: string) {
  return queueSceneVideoJob(sceneId);
}

export async function pollSceneVideoJob(jobId: string) {
  const result = await processVideoJob(jobId);
  if (result.status === "completed") {
    const admin = createAdminClient();
    const { data: job } = await admin.from("walkthrough_video_jobs").select("experience_id").eq("id", jobId).single();
    if (job?.experience_id) await refreshWalkthroughChecklist(job.experience_id);
  }
  return {
    jobId: result.jobId,
    status: result.status,
    video_url: result.video_url,
    error: result.error,
  };
}

export async function queueAllSceneVideoJobs(
  experienceId: string,
  options?: { videoMode?: VeoGenerationMode },
) {
  const admin = createAdminClient();
  const videoMode = options?.videoMode ?? DEFAULT_VEO_GENERATION_MODE;
  const { data: scenes } = await admin
    .from("walkthrough_scenes")
    .select("id")
    .eq("experience_id", experienceId)
    .is("video_url", null)
    .order("scene_order");

  const results = await runWithWorkerPool(
    (scenes ?? []).map((s) => s.id),
    VEO_PIPELINE.maxConcurrency,
    async (sceneId) => {
      try {
        const queued = await queueSceneVideoJob(sceneId, { videoMode });
        return { sceneId, ok: true, status: queued.status };
      } catch (e) {
        return { sceneId, ok: false, error: e instanceof Error ? e.message : "failed" };
      }
    },
  );

  if (results.some((r) => r.ok)) {
    kickVideoPollCycle(experienceId);
  }

  return results;
}

export async function submitAllSceneVideoJobs(experienceId: string) {
  return queueAllSceneVideoJobs(experienceId);
}

export async function pollPendingVideoJobs(experienceId: string) {
  const { results, timings } = await processExperienceVideoJobs(experienceId);

  if (results.some((r) => r.status === "completed")) {
    await refreshWalkthroughChecklist(experienceId);
  }

  return results.map((r) => ({
    jobId: r.jobId,
    status: r.status,
    video_url: r.video_url,
    error: r.error,
    stage: r.stage,
    timings: r.timings ?? timings,
    validation: r.validation,
    generationDurationMs: r.generationDurationMs,
    model: r.model,
  }));
}

export async function runSceneVideoGeneration(
  sceneId: string,
  options?: { force?: boolean; videoMode?: VeoGenerationMode },
) {
  const submitted = await queueSceneVideoJob(sceneId, options);
  if (submitted.status === "completed" && "video_url" in submitted) {
    return submitted.video_url!;
  }

  const jobId = submitted.jobId;
  if (!jobId) throw new Error("Failed to submit video job");

  const { getAdaptivePollIntervalMs } = await import("@/lib/walkthrough-pipeline/adaptive-poll");
  const started = Date.now();

  for (let i = 0; i < 120; i++) {
    const result = await pollSceneVideoJob(jobId);
    if (result.status === "completed" && result.video_url) return result.video_url;
    if (result.status === "failed") throw new Error(result.error ?? "Video generation failed");
    await new Promise((r) => setTimeout(r, getAdaptivePollIntervalMs(Date.now() - started)));
  }
  throw new Error("Video generation timed out");
}

export async function generateAllSceneVideos(experienceId: string) {
  return submitAllSceneVideoJobs(experienceId);
}

export { MAX_IMAGES };
