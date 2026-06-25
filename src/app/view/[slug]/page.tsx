"use client";

import { Suspense } from "react";
import { useParams, useSearchParams } from "next/navigation";
import { BuyerViewer } from "@/components/buyer/buyer-viewer";

function ViewContent() {
  const params = useParams();
  const searchParams = useSearchParams();
  const slug = params.slug as string;
  const utm = {
    utm_source: searchParams.get("utm_source") ?? undefined,
    utm_medium: searchParams.get("utm_medium") ?? undefined,
    utm_campaign: searchParams.get("utm_campaign") ?? undefined,
  };

  const preview = searchParams.get("preview") === "1";

  return <BuyerViewer slug={slug} utm={utm} preview={preview} />;
}

export default function BuyerViewPage() {
  return (
    <Suspense fallback={<div className="flex h-screen items-center justify-center bg-black text-white">Loading…</div>}>
      <ViewContent />
    </Suspense>
  );
}
