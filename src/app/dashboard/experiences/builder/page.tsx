"use client";

import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { Tour360Builder } from "@/components/experience/tour360-builder";
import { WorldLabsBuilder } from "@/components/experience/worldlabs-builder";
import { ImmersiveWorldBuilder } from "@/components/experience/immersive-world-builder";
import { SceneIntelligenceBuilder } from "@/components/experience/scene-intelligence-builder";
import type { ExperienceType } from "@/types/domain";

function BuilderContent() {
  const params = useSearchParams();
  const type = (params.get("type") ?? "360_realistic") as ExperienceType;
  const experienceId = params.get("id") ?? "00000000-0000-0000-0000-000000000001";
  const propertyId = params.get("propertyId") ?? "00000000-0000-0000-0000-000000000002";

  if (type === "scene_intelligence") {
    return <SceneIntelligenceBuilder experienceId={experienceId} propertyId={propertyId} />;
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="section-title">Experience Builder</h1>
        <p className="text-muted-foreground">
          {type === "worldlabs_splat"
            ? "Generate 3D Walkthrough"
            : type === "immersive_world"
              ? "Immersive World"
              : type === "mobile_360_capture"
                ? "Mobile 360° Capture Walkthrough"
                : "360° Realistic Experience"}
        </p>
      </div>
      {type === "worldlabs_splat" ? (
        <WorldLabsBuilder experienceId={experienceId} propertyId={propertyId} />
      ) : type === "immersive_world" ? (
        <ImmersiveWorldBuilder experienceId={experienceId} propertyId={propertyId} />
      ) : type === "mobile_360_capture" ? (
        <div className="text-sm text-muted-foreground">
          Open the <a href={`/dashboard/capture/${experienceId}?propertyId=${propertyId}`} className="text-primary underline">mobile capture wizard</a> to capture rooms with your phone.
        </div>
      ) : (
        <Tour360Builder experienceId={experienceId} propertyId={propertyId} />
      )}
    </div>
  );
}

export default function ExperienceBuilderPage() {
  return (
    <Suspense fallback={<div className="p-6">Loading builder…</div>}>
      <BuilderContent />
    </Suspense>
  );
}
