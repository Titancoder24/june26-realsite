"use client";

import { Suspense, useEffect, useState } from "react";
import { useParams, useSearchParams } from "next/navigation";
import { CinematicWalkthroughWizard } from "@/components/walkthrough/cinematic-walkthrough-wizard";

function WalkthroughPageContent() {
  const params = useParams();
  const searchParams = useSearchParams();
  const experienceId = params.experienceId as string;
  const propertyId = searchParams.get("propertyId") ?? "";
  const [slug, setSlug] = useState<string>();

  useEffect(() => {
    fetch(`/api/experiences/${experienceId}`)
      .then((r) => r.json())
      .then((d) => setSlug(d.slug))
      .catch(() => {});
  }, [experienceId]);

  if (!propertyId) {
    return <div className="p-6 text-muted-foreground">Missing propertyId in URL.</div>;
  }

  return (
    <CinematicWalkthroughWizard
      experienceId={experienceId}
      propertyId={propertyId}
      slug={slug}
    />
  );
}

export default function WalkthroughStudioPage() {
  return (
    <Suspense fallback={<div className="p-6">Loading walkthrough studio…</div>}>
      <WalkthroughPageContent />
    </Suspense>
  );
}
