import { createAdminClient } from "@/lib/supabase/admin";
import { ROOM_TEMPLATES, type PropertyTemplate } from "@/lib/capture/room-templates";

export class CaptureService {
  async initRooms(params: {
    experienceId: string;
    propertyId: string;
    organizationId: string;
    template: PropertyTemplate;
    customRooms?: string[];
  }) {
    const admin = createAdminClient();
    const roomNames = params.customRooms?.length
      ? params.customRooms
      : ROOM_TEMPLATES[params.template].rooms;

    await admin.from("capture_rooms").delete().eq("experience_id", params.experienceId);

    const rows = roomNames.map((name, i) => ({
      experience_id: params.experienceId,
      property_id: params.propertyId,
      organization_id: params.organizationId,
      room_name: name,
      room_type: params.template,
      sort_order: i,
      status: "not_started",
    }));

    const { data, error } = await admin.from("capture_rooms").insert(rows).select();
    if (error) throw error;

    await admin.from("experiences").update({
      viewer_config: { capture_template: params.template, capture_mode: "mobile_guided" },
      updated_at: new Date().toISOString(),
    }).eq("id", params.experienceId);

    return data;
  }

  async listRooms(experienceId: string) {
    const admin = createAdminClient();
    const { data: rooms, error } = await admin
      .from("capture_rooms")
      .select("*, capture_frames(*)")
      .eq("experience_id", experienceId)
      .order("sort_order");
    if (error) throw error;
    return rooms ?? [];
  }

  async addFrame(params: {
    captureRoomId: string;
    angleLabel: string;
    imageUrl: string;
    mediaAssetId?: string;
    sortOrder?: number;
    metadata?: Record<string, unknown>;
  }) {
    const admin = createAdminClient();
    await admin.from("capture_rooms").update({ status: "capturing", updated_at: new Date().toISOString() }).eq("id", params.captureRoomId);

    const { data, error } = await admin.from("capture_frames").insert({
      capture_room_id: params.captureRoomId,
      angle_label: params.angleLabel,
      image_url: params.imageUrl,
      media_asset_id: params.mediaAssetId,
      sort_order: params.sortOrder ?? 0,
      metadata: params.metadata ?? {},
    }).select().single();
    if (error) throw error;
    return data;
  }

  async updateRoom(id: string, updates: Record<string, unknown>) {
    const admin = createAdminClient();
    const { data, error } = await admin
      .from("capture_rooms")
      .update({ ...updates, updated_at: new Date().toISOString() })
      .eq("id", id)
      .select()
      .single();
    if (error) throw error;
    return data;
  }

  async getPublishChecklist(experienceId: string) {
    const admin = createAdminClient();
    const { data: scenes } = await admin.from("tour_360_scenes").select("*").eq("experience_id", experienceId);
    const { data: rooms } = await admin.from("capture_rooms").select("*").eq("experience_id", experienceId);
    const { data: floorMaps } = await admin.from("floor_maps").select("*").eq("experience_id", experienceId);
    const { data: checkpoints } = await admin.from("checkpoints").select("*").eq("experience_id", experienceId);

    const sceneList = scenes ?? [];
    const issues: string[] = [];

    if (!sceneList.length) issues.push("No rooms have been captured yet.");
    const noStart = !sceneList.some((s) => s.is_start_scene);
    if (sceneList.length && noStart) issues.push("No starting view has been set.");
    const noView = sceneList.filter((s) => s.initial_yaw == null && s.initial_pitch == null);
    if (noView.length) issues.push(`${noView.length} room(s) have no saved starting view.`);

    const scenesWithAnnotations = sceneList.filter((s) => {
      const hotspots = (s.hotspots as unknown[]) ?? [];
      return hotspots.length > 0;
    });
    if (sceneList.length > 1 && scenesWithAnnotations.length < sceneList.length) {
      issues.push(`${sceneList.length - scenesWithAnnotations.length} room(s) have no annotations yet.`);
    }

    const disconnected = sceneList.filter((s) => {
      const hotspots = (s.hotspots as { targetSceneId?: string }[]) ?? [];
      return !hotspots.some((h) => h.targetSceneId) && sceneList.length > 1;
    });
    if (disconnected.length) {
      issues.push(`${disconnected.length} room(s) have no navigation links to other rooms.`);
    }

    const incompleteRooms = (rooms ?? []).filter((r) => r.status !== "complete");
    if (incompleteRooms.length) issues.push(`${incompleteRooms.length} capture room(s) are incomplete.`);

    const floorMap = floorMaps?.[0];
    if (floorMap) {
      const pins = (floorMap.pins as { sceneId?: string }[]) ?? [];
      const unlinked = pins.filter((p) => !p.sceneId);
      if (unlinked.length) issues.push(`${unlinked.length} floor map pin(s) are not linked to rooms.`);
    }

    return {
      ready: issues.length === 0 && sceneList.length > 0,
      issues,
      stats: {
        scenes: sceneList.length,
        captureRooms: rooms?.length ?? 0,
        completeRooms: rooms?.filter((r) => r.status === "complete").length ?? 0,
        checkpoints: checkpoints?.length ?? 0,
        hasFloorMap: Boolean(floorMap),
      },
    };
  }
}

export const captureService = new CaptureService();
