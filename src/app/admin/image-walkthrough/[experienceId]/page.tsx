"use client";

import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useSearchParams } from "next/navigation";
import { ImageWalkthroughWizard } from "@/components/image-walkthrough/image-walkthrough-wizard";

function AdminImageWalkthroughStudioContent() {
  const params = useParams();
  const searchParams = useSearchParams();
  const experienceId = params.experienceId as string;
  const propertyId = searchParams.get("propertyId") ?? "";
  const [slug, setSlug] = useState<string>();

  useEffect(() => {
    fetch(`/api/experiences/${experienceId}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => d && setSlug(d.slug))
      .catch(() => {});
  }, [experienceId]);

  if (!propertyId) {
    return (
      <p className="text-sm text-muted-foreground">
        Missing propertyId query parameter. Return to{" "}
        <Link href="/admin/image-walkthrough" className="underline">Image Walkthrough</Link> and open the studio from the list.
      </p>
    );
  }

  return (
    <ImageWalkthroughWizard
      experienceId={experienceId}
      propertyId={propertyId}
      slug={slug}
    />
  );
}

export default function AdminImageWalkthroughStudioPage() {
  return (
    <Suspense fallback={<div>Loading Image Walkthrough studio…</div>}>
      <AdminImageWalkthroughStudioContent />
    </Suspense>
  );
}
