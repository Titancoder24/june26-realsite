"use client";

import { use } from "react";
import { useSearchParams } from "next/navigation";
import { Suspense } from "react";
import { MobileCaptureWizard } from "@/components/capture/mobile-capture-wizard";

function CaptureContent({ experienceId }: { experienceId: string }) {
  const params = useSearchParams();
  const propertyId = params.get("propertyId") ?? "";

  return (
    <div className="bi-dashboard bi-module-shell p-6">
      <div className="bi-module-hero">
        <div>
          <p className="bi-module-kicker">360 Capture</p>
          <h1>Mobile walkthrough capture</h1>
          <p>Create a walkthrough using the phone camera, then review the captured rooms inside the same modern reporting experience.</p>
        </div>
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
