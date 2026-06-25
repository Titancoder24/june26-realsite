/**
 * Feature flags for Property (video) Walkthrough behavior.
 * Image Walkthrough annotations are unaffected.
 */
export const VIDEO_WALKTHROUGH_ANNOTATIONS_ENABLED = false;

export const VIDEO_WALKTHROUGH_WIZARD_STEPS = VIDEO_WALKTHROUGH_ANNOTATIONS_ENABLED
  ? (["upload", "enhance", "scenes", "arrange", "motion", "pins", "rag", "preview", "publish"] as const)
  : (["upload", "enhance", "scenes", "arrange", "motion", "rag", "preview", "publish"] as const);
