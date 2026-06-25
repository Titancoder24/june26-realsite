import type { WalkthroughScene } from "@/types/cinematic-walkthrough";

type VideoJobLike = {
  stored_video_url?: string | null;
  video_url_1080p?: string | null;
};

/** Resolve playable video URL from scene row and optional latest job fallback. */
export function resolveWalkthroughSceneVideoUrl(
  scene: Pick<
    WalkthroughScene,
    "video_url" | "video_url_1080p" | "video_url_720p" | "video_url_mobile"
  >,
  job?: VideoJobLike | null,
  preferMobile = false,
): string | null {
  if (preferMobile) {
    return (
      scene.video_url_mobile ??
      scene.video_url_720p ??
      scene.video_url ??
      scene.video_url_1080p ??
      job?.stored_video_url ??
      job?.video_url_1080p ??
      null
    );
  }
  return (
    scene.video_url_1080p ??
    scene.video_url ??
    scene.video_url_720p ??
    scene.video_url_mobile ??
    job?.stored_video_url ??
    job?.video_url_1080p ??
    null
  );
}
