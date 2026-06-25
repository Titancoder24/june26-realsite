"use client";

import { use } from "react";
import { useSearchParams } from "next/navigation";
import { Suspense } from "react";
import { MobileCaptureWizard } from "@/components/capture/mobile-capture-wizard";

function CaptureContent({ experienceId }: { experienceId: string }) {
  const params = useSearchParams();
  const propertyId = params.get("propertyId") ?? "";

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-semibold md:text-2xl">Mobile Walkthrough Capture</h1>
        <p className="text-sm text-muted-foreground">Create walkthrough using phone camera</p>
      </div>
      {propertyId ? (
        <MobileCaptureWizard experienceId={experienceId} propertyId={propertyId} />
      ) : (
        <p className="text-sm text-destructive">Missing propertyId in URL.</p>
      )}
    </div>
  );
}

export default function CapturePage({ params }: { params: Promise<{ experienceId: string }> }) {
  const { experienceId } = use(params);
  return (
    <Suspense fallback={<div className="p-6">Loading capture…</div>}>
      <CaptureContent experienceId={experienceId} />
    </Suspense>
  );
}
