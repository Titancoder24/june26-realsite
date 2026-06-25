import { createAdminClient } from "@/lib/supabase/admin";
import { SPHERE_CAPTURE } from "@/lib/capture/capture-protocol";

const MIN_FRAMES = SPHERE_CAPTURE.minBuckets;

export interface StitchRoomOptions {
  stitchedImageUrl?: string;
  panoramaConfig?: Record<string, unknown>;
  initialYaw?: number;
  initialPitch?: number;
  /** Client-side extracted frame count — used for quality when DB frames not yet uploaded. */
  extractedFrameCount?: number;
}

export class StitchService {
  async processRoom(captureRoomId: string, options: StitchRoomOptions = {}) {
    const {
      stitchedImageUrl,
      panoramaConfig,
      initialYaw = 0,
      initialPitch = 0,
      extractedFrameCount,
    } = options;

    const admin = createAdminClient();

    const { data: room } = await admin
      .from("capture_rooms")
      .select("*, capture_frames(*)")
      .eq("id", captureRoomId)
      .single();
    if (!room) throw new Error("Capture room not found");

    const frames = (room.capture_frames as { angle_label: string; image_url: string; sort_order: number }[]) ?? [];
    frames.sort((a, b) => a.sort_order - b.sort_order);

    const effectiveFrameCount = Math.max(frames.length, extractedFrameCount ?? 0);
    const hasClientPanorama = Boolean(stitchedImageUrl);

    // Client already stitched in-browser — trust the uploaded panorama URL.
    if (!hasClientPanorama && frames.length < MIN_FRAMES) {
      await admin.from("capture_rooms").update({ status: "needs_retake", quality_score: "Missing" }).eq("id", captureRoomId);
      const { data: job } = await admin.from("stitch_jobs").insert({
        capture_room_id: captureRoomId,
        experience_id: room.experience_id,
        organization_id: room.organization_id,
        status: "needs_more_angles",
        frame_count: frames.length,
        error_message: `Need at least ${MIN_FRAMES} angles. We need one more angle to complete this room.`,
      }).select().single();
      return { job, scene: null, needsRetake: true };
    }

    if (hasClientPanorama && !stitchedImageUrl) {
      throw new Error("Panorama upload failed — no image URL");
    }

    const { data: job } = await admin.from("stitch_jobs").insert({
      capture_room_id: captureRoomId,
      experience_id: room.experience_id,
      organization_id: room.organization_id,
      status: "processing",
      frame_count: effectiveFrameCount,
    }).select().single();

    await admin.from("capture_rooms").update({ status: "processing" }).eq("id", captureRoomId);

    const panoramaUrl = stitchedImageUrl ?? frames.find((f) => f.angle_label === "front")?.image_url ?? frames[0]?.image_url;
    if (!panoramaUrl) throw new Error("No panorama image available");

    const thumbnailUrl = hasClientPanorama ? stitchedImageUrl : (frames[0]?.image_url ?? stitchedImageUrl);
    const quality =
      effectiveFrameCount >= SPHERE_CAPTURE.bucketCount
        ? "Excellent"
        : effectiveFrameCount >= SPHERE_CAPTURE.minBuckets
          ? "Great"
          : effectiveFrameCount >= 20
            ? "Good"
            : effectiveFrameCount >= 12
              ? "Fair"
              : "Needs retake";

    const { data: existingScenes } = await admin
      .from("tour_360_scenes")
      .select("id")
      .eq("experience_id", room.experience_id);

    const isFirst = !existingScenes?.length;

    let scene;
    const scenePayload = {
      room_name: room.room_name,
      image_url: panoramaUrl,
      thumbnail_url: thumbnailUrl,
      initial_yaw: initialYaw,
      initial_pitch: initialPitch,
      panorama_config: panoramaConfig ?? {},
    };

    if (room.scene_id) {
      const { data } = await admin.from("tour_360_scenes").update(scenePayload).eq("id", room.scene_id).select().single();
      scene = data;
    } else {
      const { data, error } = await admin.from("tour_360_scenes").insert({
        ...scenePayload,
        experience_id: room.experience_id,
        property_id: room.property_id,
        is_start_scene: isFirst,
        sort_order: room.sort_order ?? 0,
      }).select().single();
      if (error) throw error;
      scene = data;
    }

    // Auto-create a navigable checkpoint for this scene
    const { data: existingCp } = await admin
      .from("checkpoints")
      .select("id")
      .eq("experience_id", room.experience_id)
      .eq("scene_id", scene.id)
      .maybeSingle();

    if (!existingCp) {
      await admin.from("checkpoints").insert({
        experience_id: room.experience_id,
        property_id: room.property_id,
        scene_id: scene.id,
        title: room.room_name,
        description: `360° view of ${room.room_name}`,
        checkpoint_type: "navigation",
        sort_order: room.sort_order ?? 0,
        visibility: "public",
      });
    }

    await admin.from("capture_rooms").update({
      status: "complete",
      quality_score: quality,
      scene_id: scene.id,
      updated_at: new Date().toISOString(),
    }).eq("id", captureRoomId);

    await admin.from("stitch_jobs").update({
      status: "succeeded",
      result_scene_id: scene.id,
      stitched_image_url: panoramaUrl,
      completed_at: new Date().toISOString(),
    }).eq("id", job!.id);

    await admin.from("experiences").update({
      status: "ready_for_review",
      updated_at: new Date().toISOString(),
    }).eq("id", room.experience_id);

    return { job, scene, needsRetake: false };
  }
}

export const stitchService = new StitchService();
