"use client";

import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { FloorMapBuilder } from "@/components/builders/floor-map-builder";

function Content() {
  const params = useSearchParams();
  const propertyId = params.get("propertyId") ?? "";
  const experienceId = params.get("experienceId") ?? undefined;
  if (!propertyId) return <p className="text-muted-foreground">Select a property from experiences builder to edit floor maps.</p>;
  return <FloorMapBuilder propertyId={propertyId} experienceId={experienceId} />;
}

export default function FloorMapsPage() {
  return (
    <div className="space-y-6">
      <h1 className="section-title">Floor Map Builder</h1>
      <Suspense fallback={<p>Loading…</p>}><Content /></Suspense>
    </div>
  );
}
