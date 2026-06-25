import { createAdminClient } from "@/lib/supabase/admin";
import { worldLabsService } from "./world-labs.service";

const MAX_FILE_SIZE = 50 * 1024 * 1024;
const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp", "image/jpg", "video/mp4", "video/quicktime"];

export function validateMediaFile(file: File) {
  if (file.size > MAX_FILE_SIZE) throw new Error(`File too large. Max ${MAX_FILE_SIZE / 1024 / 1024}MB`);
  if (!ALLOWED_TYPES.includes(file.type)) throw new Error(`Unsupported type: ${file.type}`);
}

export class MediaService {
  async uploadToStorage(file: File, organizationId: string, propertyId?: string) {
    validateMediaFile(file);
    const admin = createAdminClient();
    const ext = file.name.split(".").pop() ?? "bin";
    const path = `${organizationId}/${propertyId ?? "general"}/${Date.now()}.${ext}`;

    const buffer = await file.arrayBuffer();
    const { error: uploadError } = await admin.storage.from("media").upload(path, buffer, { contentType: file.type, upsert: false });
    if (uploadError) throw uploadError;

    const { data: { publicUrl } } = admin.storage.from("media").getPublicUrl(path);

    const { data: asset, error } = await admin.from("media_assets").insert({
      organization_id: organizationId,
      property_id: propertyId,
      file_name: file.name,
      file_url: publicUrl,
      content_type: file.type,
      file_size: file.size,
      asset_type: file.type.startsWith("image/") ? "image" : "video",
      metadata: { thumbnail_url: file.type.startsWith("image/") ? publicUrl : null },
    }).select().single();

    if (error) throw error;
    return asset;
  }

  async uploadToWorldLabs(file: File, organizationId: string, propertyId?: string) {
    const asset = await this.uploadToStorage(file, organizationId, propertyId);
    try {
      const prepared = await worldLabsService.prepareMediaUpload(file.name, file.type);
      const buffer = await file.arrayBuffer();
      await worldLabsService.uploadToSignedUrl(prepared.upload_url, buffer, file.type, prepared.upload_headers);
      const admin = createAdminClient();
      await admin.from("media_assets").update({ worldlabs_media_asset_id: prepared.media_asset_id }).eq("id", asset.id);
      return { ...asset, worldlabs_media_asset_id: prepared.media_asset_id };
    } catch (err) {
      const admin = createAdminClient();
      await admin.from("media_assets").update({ metadata: { worldlabs_upload_error: err instanceof Error ? err.message : "upload failed" } }).eq("id", asset.id);
      throw new Error(`World Labs media upload failed: ${err instanceof Error ? err.message : "unknown error"}`);
    }
  }
}

export const mediaService = new MediaService();
