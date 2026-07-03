/**
 * Free Supabase storage quota by removing orphaned files and superseded originals.
 * Usage: node scripts/cleanup-supabase-storage-quota.mjs
 */
import { readFileSync } from "fs";
import { createClient } from "@supabase/supabase-js";

function loadEnvLocal() {
  try {
    const raw = readFileSync(".env.local", "utf8");
    for (const line of raw.split("\n")) {
      const m = line.match(/^([^#=]+)=(.*)$/);
      if (!m) continue;
      const key = m[1].trim();
      const val = m[2].trim().replace(/^["']|["']$/g, "");
      if (!process.env[key]) process.env[key] = val;
    }
  } catch {
    // optional
  }
}

loadEnvLocal();

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !serviceKey) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
  process.exit(1);
}

const admin = createClient(url, serviceKey, { auth: { persistSession: false } });

const URL_COLUMNS = [
  ["media_assets", "file_url"],
  ["capture_frames", "image_url"],
  ["floor_maps", "image_url"],
  ["image_walkthrough_nodes", "enhanced_image_url"],
  ["image_walkthrough_nodes", "image_url"],
  ["image_walkthrough_nodes", "original_image_url"],
  ["image_walkthrough_nodes", "thumbnail_url"],
  ["brochures", "file_url"],
  ["property_brochures", "file_url"],
  ["property_brochures", "thumbnail_url"],
  ["property_scenes", "edited_image_url"],
  ["property_scenes", "image_url"],
  ["property_scenes", "thumbnail_url"],
  ["scene_annotations", "media_url"],
  ["splat_worlds", "spz_100k_url"],
  ["splat_worlds", "spz_500k_url"],
  ["splat_worlds", "spz_full_res_url"],
  ["splat_worlds", "thumbnail_url"],
  ["stitch_jobs", "stitched_image_url"],
  ["tour_360_scenes", "image_url"],
  ["tour_360_scenes", "thumbnail_url"],
  ["walkthrough_annotations", "media_url"],
  ["walkthrough_enhancement_jobs", "result_url"],
  ["walkthrough_images", "desktop_crop_url"],
  ["walkthrough_images", "enhanced_image_url"],
  ["walkthrough_images", "mobile_crop_url"],
  ["walkthrough_images", "original_image_url"],
  ["walkthrough_images", "thumbnail_url"],
  ["walkthrough_scenes", "edited_image_url"],
  ["walkthrough_scenes", "image_url"],
  ["walkthrough_scenes", "poster_url"],
  ["walkthrough_scenes", "thumbnail_url"],
  ["walkthrough_scenes", "video_url"],
  ["walkthrough_scenes", "video_url_1080p"],
  ["walkthrough_scenes", "video_url_720p"],
  ["walkthrough_scenes", "video_url_mobile"],
  ["walkthrough_video_jobs", "poster_url"],
  ["walkthrough_video_jobs", "stored_video_url"],
  ["walkthrough_video_jobs", "video_url_1080p"],
  ["walkthrough_video_jobs", "video_url_720p"],
  ["walkthrough_video_jobs", "video_url_mobile"],
];

function mediaPath(value) {
  if (!value || typeof value !== "string") return null;
  const marker = "/storage/v1/object/public/media/";
  const idx = value.indexOf(marker);
  if (idx === -1) return null;
  return decodeURIComponent(value.slice(idx + marker.length));
}

async function collectReferencedPaths() {
  const refs = new Set();
  for (const [table, column] of URL_COLUMNS) {
    const { data, error } = await admin.from(table).select(column).not(column, "is", null);
    if (error) {
      console.warn(`Skipping ${table}.${column}: ${error.message}`);
      continue;
    }
    for (const row of data ?? []) {
      const path = mediaPath(row[column]);
      if (path) refs.add(path);
    }
  }
  return refs;
}

async function listFolder(prefix = "") {
  const paths = [];
  let offset = 0;
  while (true) {
    const { data, error } = await admin.storage.from("media").list(prefix, {
      limit: 1000,
      offset,
      sortBy: { column: "name", order: "asc" },
    });
    if (error) throw error;
    if (!data?.length) break;

    for (const item of data) {
      const next = prefix ? `${prefix}/${item.name}` : item.name;
      if (item.id) paths.push(next);
      else paths.push(...(await listFolder(next)));
    }

    if (data.length < 1000) break;
    offset += data.length;
  }
  return paths;
}

async function collectSupersededOriginalPaths() {
  const paths = new Set();

  const { data: walkthroughImages, error: wiError } = await admin
    .from("walkthrough_images")
    .select("original_image_url, enhanced_image_url")
    .not("enhanced_image_url", "is", null)
    .not("original_image_url", "is", null);

  if (wiError) throw wiError;
  for (const row of walkthroughImages ?? []) {
    if (row.original_image_url !== row.enhanced_image_url) {
      const path = mediaPath(row.original_image_url);
      if (path) paths.add(path);
    }
  }

  const { data: nodes, error: nodeError } = await admin
    .from("image_walkthrough_nodes")
    .select("original_image_url, enhanced_image_url, image_url")
    .not("enhanced_image_url", "is", null)
    .not("original_image_url", "is", null);

  if (nodeError) throw nodeError;
  for (const row of nodes ?? []) {
    if (row.original_image_url !== row.enhanced_image_url && row.image_url === row.enhanced_image_url) {
      const path = mediaPath(row.original_image_url);
      if (path) paths.add(path);
    }
  }

  return paths;
}

async function deletePaths(paths) {
  const unique = [...new Set(paths.filter(Boolean))];
  let deleted = 0;
  for (let i = 0; i < unique.length; i += 100) {
    const batch = unique.slice(i, i + 100);
    const { data, error } = await admin.storage.from("media").remove(batch);
    if (error) throw error;
    deleted += data?.length ?? batch.length;
    console.log(`Deleted batch ${Math.floor(i / 100) + 1}: ${batch.length} files`);
  }
  return deleted;
}

console.log("Collecting referenced storage paths...");
const refs = await collectReferencedPaths();
console.log(`Referenced paths: ${refs.size}`);

console.log("Listing storage objects...");
const allPaths = await listFolder();
console.log(`Storage objects: ${allPaths.length}`);

const orphaned = allPaths.filter((path) => !refs.has(path));
console.log(`Orphaned files: ${orphaned.length}`);

console.log("Finding superseded originals...");
const superseded = await collectSupersededOriginalPaths();
console.log(`Superseded originals: ${superseded.size}`);

const toDelete = [...new Set([...orphaned, ...superseded])];
console.log(`Total to delete: ${toDelete.length}`);

if (toDelete.length === 0) {
  console.log("Nothing to delete.");
  process.exit(0);
}

const deleted = await deletePaths(toDelete);
console.log(`Removed ${deleted} storage objects.`);

console.log("Updating database records for superseded originals...");
const { data: wiRows, error: wiRowsError } = await admin
  .from("walkthrough_images")
  .select("id, original_image_url, enhanced_image_url")
  .not("enhanced_image_url", "is", null)
  .not("original_image_url", "is", null);
if (wiRowsError) throw wiRowsError;
for (const row of wiRows ?? []) {
  if (row.original_image_url !== row.enhanced_image_url) {
    const { error } = await admin
      .from("walkthrough_images")
      .update({ original_image_url: row.enhanced_image_url })
      .eq("id", row.id);
    if (error) throw error;
  }
}

const { data: nodeRows, error: nodeRowsError } = await admin
  .from("image_walkthrough_nodes")
  .select("id, original_image_url, enhanced_image_url, image_url")
  .not("enhanced_image_url", "is", null)
  .not("original_image_url", "is", null);
if (nodeRowsError) throw nodeRowsError;
for (const row of nodeRows ?? []) {
  if (row.original_image_url !== row.enhanced_image_url && row.image_url === row.enhanced_image_url) {
    const { error } = await admin
      .from("image_walkthrough_nodes")
      .update({ original_image_url: row.enhanced_image_url })
      .eq("id", row.id);
    if (error) throw error;
  }
}

console.log("Cleanup complete.");
