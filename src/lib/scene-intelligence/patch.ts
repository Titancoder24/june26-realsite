import type { PropertyScene } from "@/types/scene-intelligence";

/** Strip DB extras before PATCH — avoids zod failures on nested relations / string numerics. */
export function toPropertyScenePatch(scene: Partial<PropertyScene>): Record<string, unknown> {
  const patch: Record<string, unknown> = {};
  if (scene.title != null) patch.title = scene.title;
  if (scene.description != null) patch.description = scene.description;
  if (scene.image_url != null) patch.image_url = scene.image_url;
  if (scene.edited_image_url != null) patch.edited_image_url = scene.edited_image_url;
  if (scene.thumbnail_url != null) patch.thumbnail_url = scene.thumbnail_url;
  if (scene.scene_order != null) patch.scene_order = Number(scene.scene_order);
  if (scene.is_start_scene != null) patch.is_start_scene = scene.is_start_scene;
  if (scene.motion_type != null) patch.motion_type = scene.motion_type;
  if (scene.motion_config != null) patch.motion_config = scene.motion_config;
  if (scene.duration != null) patch.duration = Number(scene.duration);
  if (scene.edit_config != null) patch.edit_config = scene.edit_config;
  if (scene.mobile_crop != null) patch.mobile_crop = scene.mobile_crop;
  if (scene.desktop_crop != null) patch.desktop_crop = scene.desktop_crop;
  if (scene.ai_context != null) patch.ai_context = scene.ai_context;
  return patch;
}
