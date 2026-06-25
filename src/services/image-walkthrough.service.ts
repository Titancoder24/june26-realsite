import { v4 as uuidv4 } from "uuid";
import { createAdminClient } from "@/lib/supabase/admin";
import { logApiUsage } from "@/lib/api-usage-logger";
import { getVertexAIConfig } from "@/lib/platform-settings";
import { vertexAIService, ENHANCEMENT_PROMPT, VERTEX_IMAGE_MODEL } from "./vertex-ai.service";
import type {
  ImageWalkthroughChecklist,
  ImageWalkthroughNode,
} from "@/types/image-walkthrough";
import { getNodeDisplayImageUrl, getNodeThumbnailUrl } from "@/lib/image-walkthrough-utils";

export { getNodeDisplayImageUrl, getNodeThumbnailUrl };

export const MAX_IMAGE_WALKTHROUGH_NODES = 60;

export function detectMediaType(width?: number, height?: number): "flat" | "equirectangular" {
  if (!width || !height) return "flat";
  const ratio = width / height;
  return ratio >= 1.8 && ratio <= 2.2 ? "equirectangular" : "flat";
}

export async function ensureImageWalkthroughSettings(experienceId: string) {
  const admin = createAdminClient();
  const { data } = await admin.from("image_walkthrough_settings").select("*").eq("experience_id", experienceId).maybeSingle();
  if (data) return data;
  const { data: created } = await admin.from("image_walkthrough_settings").insert({ experience_id: experienceId }).select().single();
  return created!;
}

export async function ensureImageWalkthroughChecklist(experienceId: string) {
  const admin = createAdminClient();
  const { data } = await admin.from("image_walkthrough_checklists").select("*").eq("experience_id", experienceId).maybeSingle();
  if (data) return data;
  const { data: created } = await admin.from("image_walkthrough_checklists").insert({ experience_id: experienceId }).select().single();
  return created!;
}

export async function refreshImageWalkthroughChecklist(experienceId: string): Promise<ImageWalkthroughChecklist> {
  const admin = createAdminClient();
  const existing = await ensureImageWalkthroughChecklist(experienceId);

  const [{ data: nodes }, { data: hotspots }, { data: annotations }, { data: settings }] = await Promise.all([
    admin.from("image_walkthrough_nodes").select("id, is_start_node, ai_confidence, display_name, enhancement_status").eq("experience_id", experienceId),
    admin.from("image_walkthrough_hotspots").select("id, to_node_id").eq("experience_id", experienceId),
    admin.from("image_walkthrough_annotations").select("id").eq("experience_id", experienceId),
    admin.from("image_walkthrough_settings").select("start_node_id").eq("experience_id", experienceId).maybeSingle(),
  ]);

  const nodeList = nodes ?? [];
  const nodeIds = new Set(nodeList.map((n) => n.id));
  const imagesUploaded = nodeList.length >= 1;
  const aiAnalysisCompleted = nodeList.length >= 3 && nodeList.every((n) => n.ai_confidence != null);
  const startNodeSelected = Boolean(settings?.start_node_id ?? nodeList.some((n) => n.is_start_node));
  const validHotspots = (hotspots ?? []).filter((h) => h.to_node_id && nodeIds.has(h.to_node_id));
  const navigationConnected = validHotspots.length >= 1;
  const annotationsAdded = (annotations ?? []).length >= 1;
  const previewChecked = Boolean(existing.preview_checked);
  const imagesEnhanced = nodeList.length > 0 && nodeList.every(
    (n) => n.enhancement_status === "completed" || n.enhancement_status === "skipped",
  );
  const readyToPublish =
    nodeList.length >= 3 &&
    startNodeSelected &&
    navigationConnected &&
    annotationsAdded &&
    previewChecked;

  const warnings: string[] = [];
  if (nodeList.length < 3) warnings.push("Upload at least 3 image nodes.");
  if (!startNodeSelected) warnings.push("Select a start image.");
  if (!navigationConnected) warnings.push("Connect at least one navigation hotspot.");
  if (!annotationsAdded) warnings.push("Add at least one annotation.");
  if (!previewChecked) warnings.push("Preview the walkthrough before publishing.");

  const payload = {
    images_uploaded: imagesUploaded,
    images_enhanced: imagesEnhanced,
    ai_analysis_completed: aiAnalysisCompleted,
    start_node_selected: startNodeSelected,
    navigation_connected: navigationConnected,
    annotations_added: annotationsAdded,
    preview_checked: previewChecked,
    ready_to_publish: readyToPublish,
    warnings,
    updated_at: new Date().toISOString(),
  };

  const { data } = await admin
    .from("image_walkthrough_checklists")
    .update(payload)
    .eq("experience_id", experienceId)
    .select()
    .single();

  return data as ImageWalkthroughChecklist;
}

export async function uploadImageWalkthroughNode(params: {
  buffer: ArrayBuffer;
  fileName: string;
  mimeType: string;
  fileSize: number;
  experienceId: string;
  propertyId: string;
  organizationId: string;
  sortOrder: number;
  mediaType?: "flat" | "equirectangular";
}) {
  const admin = createAdminClient();
  const nodeId = uuidv4();
  const ext = params.fileName.split(".").pop()?.toLowerCase() || "jpg";
  const storagePath = `${params.organizationId}/${params.propertyId}/image-walkthrough/${params.experienceId}/${nodeId}.${ext}`;

  const { error: uploadError } = await admin.storage.from("media").upload(storagePath, params.buffer, {
    contentType: params.mimeType,
    upsert: false,
  });
  if (uploadError) throw new Error(uploadError.message);

  const { data: { publicUrl } } = admin.storage.from("media").getPublicUrl(storagePath);

  const { data, error } = await admin.from("image_walkthrough_nodes").insert({
    id: nodeId,
    experience_id: params.experienceId,
    property_id: params.propertyId,
    organization_id: params.organizationId,
    image_url: publicUrl,
    original_image_url: publicUrl,
    thumbnail_url: publicUrl,
    original_filename: params.fileName,
    display_name: params.fileName.replace(/\.[^.]+$/, "").replace(/[_-]+/g, " "),
    room_type: "unknown",
    media_type: params.mediaType ?? "flat",
    enhancement_status: "pending",
    node_order: params.sortOrder,
    is_start_node: params.sortOrder === 0,
  }).select().single();

  if (error) {
    await admin.storage.from("media").remove([storagePath]).catch(() => {});
    throw new Error(error.message);
  }

  if (params.sortOrder === 0) {
    await ensureImageWalkthroughSettings(params.experienceId);
    await admin.from("image_walkthrough_settings").upsert({
      experience_id: params.experienceId,
      start_node_id: nodeId,
    });
  }

  await refreshImageWalkthroughChecklist(params.experienceId);
  return data as ImageWalkthroughNode;
}

export async function countImageWalkthroughNodes(experienceId: string) {
  const admin = createAdminClient();
  const { count } = await admin.from("image_walkthrough_nodes").select("*", { count: "exact", head: true }).eq("experience_id", experienceId);
  return count ?? 0;
}

export async function setStartNode(experienceId: string, nodeId: string) {
  const admin = createAdminClient();
  await admin.from("image_walkthrough_nodes").update({ is_start_node: false }).eq("experience_id", experienceId);
  await admin.from("image_walkthrough_nodes").update({ is_start_node: true }).eq("id", nodeId);
  await admin.from("image_walkthrough_settings").upsert({
    experience_id: experienceId,
    start_node_id: nodeId,
    updated_at: new Date().toISOString(),
  });
  await refreshImageWalkthroughChecklist(experienceId);
}

export async function loadImageWalkthroughBundle(experienceId: string, options?: { publicOnly?: boolean }) {
  const admin = createAdminClient();
  const [nodes, hotspots, annotations, settings, checklist] = await Promise.all([
    admin.from("image_walkthrough_nodes").select("*").eq("experience_id", experienceId).order("node_order"),
    admin.from("image_walkthrough_hotspots").select("*").eq("experience_id", experienceId),
    admin.from("image_walkthrough_annotations").select("*").eq("experience_id", experienceId),
    admin.from("image_walkthrough_settings").select("*").eq("experience_id", experienceId).maybeSingle(),
    options?.publicOnly
      ? Promise.resolve({ data: null })
      : admin.from("image_walkthrough_checklists").select("*").eq("experience_id", experienceId).maybeSingle(),
  ]);

  return {
    nodes: nodes.data ?? [],
    hotspots: hotspots.data ?? [],
    annotations: annotations.data ?? [],
    settings: settings.data,
    checklist: checklist.data,
  };
}

const IW_ENHANCEMENT_PROMPT = `${ENHANCEMENT_PROMPT} Remove any unwanted black or white letterbox borders if present. Do not add furniture or change room structure.`;

export async function runImageWalkthroughNodeEnhancement(nodeId: string): Promise<string> {
  const admin = createAdminClient();
  const { data: node, error } = await admin.from("image_walkthrough_nodes").select("*").eq("id", nodeId).single();
  if (error || !node) throw new Error("Node not found");

  const sourceUrl = node.original_image_url ?? node.image_url;
  const vertexCfg = await getVertexAIConfig();
  const enhanceModel = vertexCfg.image_model ?? VERTEX_IMAGE_MODEL;

  await admin.from("image_walkthrough_nodes").update({
    enhancement_status: "processing",
    enhancement_error: null,
    updated_at: new Date().toISOString(),
  }).eq("id", nodeId);

  try {
    const { buffer, mimeType, model } = await vertexAIService.enhanceImage(sourceUrl, IW_ENHANCEMENT_PROMPT);
    const ext = mimeType.includes("png") ? "png" : mimeType.includes("webp") ? "webp" : "jpg";
    const storagePath = `${node.organization_id}/${node.property_id}/image-walkthrough/enhanced/${node.experience_id}/${nodeId}.${ext}`;
    const { error: uploadError } = await admin.storage.from("media").upload(storagePath, buffer, {
      contentType: mimeType,
      upsert: true,
    });
    if (uploadError) throw new Error(uploadError.message);
    const { data: { publicUrl } } = admin.storage.from("media").getPublicUrl(storagePath);

    await admin.from("image_walkthrough_nodes").update({
      enhanced_image_url: publicUrl,
      image_url: publicUrl,
      thumbnail_url: publicUrl,
      enhancement_status: "completed",
      enhancement_model: model,
      enhancement_error: null,
      enhancement_completed_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }).eq("id", nodeId);

    await refreshImageWalkthroughChecklist(node.experience_id);
    await logApiUsage({
      provider: "vertex",
      operation: "image_walkthrough_enhance",
      model: model ?? enhanceModel,
      organizationId: node.organization_id,
      experienceId: node.experience_id,
      status: "success",
    });
    return publicUrl;
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Enhancement failed";
    await admin.from("image_walkthrough_nodes").update({
      enhancement_status: "failed",
      enhancement_error: msg,
      image_url: sourceUrl,
      thumbnail_url: sourceUrl,
      updated_at: new Date().toISOString(),
    }).eq("id", nodeId);
    await refreshImageWalkthroughChecklist(node.experience_id);
    await logApiUsage({
      provider: "vertex",
      operation: "image_walkthrough_enhance",
      organizationId: node.organization_id,
      experienceId: node.experience_id,
      status: "failed",
      metadata: { error: msg },
    });
    throw err;
  }
}

export async function skipImageWalkthroughNodeEnhancement(nodeId: string) {
  const admin = createAdminClient();
  const { data: node } = await admin.from("image_walkthrough_nodes").select("experience_id, original_image_url, image_url").eq("id", nodeId).single();
  if (!node) throw new Error("Node not found");
  const original = node.original_image_url ?? node.image_url;
  await admin.from("image_walkthrough_nodes").update({
    enhancement_status: "skipped",
    image_url: original,
    thumbnail_url: original,
    enhancement_error: null,
    updated_at: new Date().toISOString(),
  }).eq("id", nodeId);
  await refreshImageWalkthroughChecklist(node.experience_id);
}
