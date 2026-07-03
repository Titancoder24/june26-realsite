"use client";

import { Suspense } from "react";
import PublicBrochurePageInner from "./public-brochure-client";

export default function PublicBrochurePage({ params }: { params: Promise<{ slug: string }> }) {
  return (
    <Suspense fallback={<div className="flex min-h-[100dvh] items-center justify-center">Loading…</div>}>
      <PublicBrochurePageInner params={params} />
    </Suspense>
  );
}
