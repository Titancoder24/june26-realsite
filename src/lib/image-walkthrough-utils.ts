import type { ImageWalkthroughNode } from "@/types/image-walkthrough";

/** Prefer enhanced image when enhancement completed; always fall back to original. */
export function getNodeDisplayImageUrl(
  node: Pick<ImageWalkthroughNode, "image_url" | "original_image_url" | "enhanced_image_url" | "enhancement_status">,
): string {
  if (node.enhancement_status === "completed" && node.enhanced_image_url) {
    return node.enhanced_image_url;
  }
  return node.original_image_url ?? node.image_url;
}

export function getNodeThumbnailUrl(
  node: Pick<ImageWalkthroughNode, "thumbnail_url" | "original_image_url" | "enhanced_image_url" | "enhancement_status" | "image_url">,
): string {
  if (node.enhancement_status === "completed" && node.enhanced_image_url) {
    return node.enhanced_image_url;
  }
  return node.thumbnail_url ?? node.original_image_url ?? node.image_url;
}
