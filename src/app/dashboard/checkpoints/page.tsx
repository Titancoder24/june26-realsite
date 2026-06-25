"use client";

import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { CheckpointManager } from "@/components/builders/checkpoint-manager";

function Content() {
  const params = useSearchParams();
  const propertyId = params.get("propertyId") ?? "";
  const experienceId = params.get("experienceId") ?? "";
  if (!propertyId || !experienceId) return <p className="text-muted-foreground">Open from experience builder with propertyId and experienceId query params.</p>;
  return <CheckpointManager experienceId={experienceId} propertyId={propertyId} />;
}

export default function CheckpointsPage() {
  return (
    <div className="space-y-6">
      <h1 className="section-title">Checkpoint Manager</h1>
      <Suspense fallback={<p>Loading…</p>}><Content /></Suspense>
    </div>
  );
}
