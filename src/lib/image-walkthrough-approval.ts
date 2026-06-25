/**
 * Image Walkthrough lifecycle — super-admin create/review/publish, org-user consumption.
 * Approval gating is prepared here; enable IMAGE_WALKTHROUGH_APPROVAL_REQUIRED when ready.
 */

export type ImageWalkthroughApprovalStatus =
  | "draft"
  | "ready_for_review"
  | "approved"
  | "published";

/** When true, published tours also require explicit super-admin approval for org dashboard visibility. */
export const IMAGE_WALKTHROUGH_APPROVAL_REQUIRED = false;

export interface ImageWalkthroughExperienceMeta {
  status: string;
  /** Future dedicated column; may live in viewer_config until migrated. */
  approval_status?: ImageWalkthroughApprovalStatus | string | null;
  viewer_config?: { approval_status?: ImageWalkthroughApprovalStatus | string } | null;
}

export function getImageWalkthroughApprovalStatus(
  exp: ImageWalkthroughExperienceMeta,
): ImageWalkthroughApprovalStatus {
  const fromViewer = exp.viewer_config?.approval_status;
  if (fromViewer && typeof fromViewer === "string") {
    return fromViewer as ImageWalkthroughApprovalStatus;
  }
  if (exp.approval_status && typeof exp.approval_status === "string") {
    return exp.approval_status as ImageWalkthroughApprovalStatus;
  }
  if (exp.status === "published") return "published";
  if (exp.status === "ready_for_review") return "ready_for_review";
  return "draft";
}

export function imageWalkthroughAdminListPath() {
  return "/admin/image-walkthrough";
}

export function imageWalkthroughAdminStudioPath(experienceId: string, propertyId: string) {
  return `/admin/image-walkthrough/${experienceId}?propertyId=${propertyId}`;
}

/** Org users may view the public buyer experience (not the studio). */
export function isImageWalkthroughVisibleToOrgUsers(exp: ImageWalkthroughExperienceMeta): boolean {
  if (exp.status !== "published") return false;
  if (!IMAGE_WALKTHROUGH_APPROVAL_REQUIRED) return true;
  const approval = getImageWalkthroughApprovalStatus(exp);
  return approval === "approved" || approval === "published";
}

/** Org dashboard Virtual Tours list — hide drafts; show only consumer-ready tours. */
export function shouldShowImageWalkthroughInDashboard(exp: ImageWalkthroughExperienceMeta): boolean {
  return isImageWalkthroughVisibleToOrgUsers(exp);
}
