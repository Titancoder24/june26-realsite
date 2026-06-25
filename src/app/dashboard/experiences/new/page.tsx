"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ExperienceTypeSelector } from "@/components/experience/experience-type-selector";
import "@/styles/scene-studio.css";
import type { ExperienceType } from "@/types/domain";
import { toast } from "sonner";

export default function NewExperiencePage() {
  const [selected, setSelected] = useState<ExperienceType>();
  const [propertyId, setPropertyId] = useState("");
  const [properties, setProperties] = useState<{ id: string; name: string }[]>([]);
  const [creating, setCreating] = useState(false);
  const router = useRouter();

  useEffect(() => {
    fetch("/api/properties")
      .then(async (r) => {
        const data = await r.json();
        if (!r.ok) throw new Error(data.error ?? "Failed to load properties");
        return Array.isArray(data) ? data : [];
      })
      .then(setProperties)
      .catch((e) => toast.error(e instanceof Error ? e.message : "Failed to load properties"));
  }, []);

  async function continueWithType(type: ExperienceType) {
    setSelected(type);
    if (!propertyId) {
      toast.error("Select a property first, then click Next");
      return;
    }
    setCreating(true);
    const res = await fetch("/api/experiences", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ property_id: propertyId, type }),
    });
    const data = await res.json();
    setCreating(false);
    if (!res.ok) {
      const msg = data.error ?? "Failed to create experience";
      toast.error(msg.length > 120 ? `${msg.slice(0, 120)}…` : msg);
      return;
    }
    toast.success("Experience created");
    if (type === "mobile_360_capture") {
      router.push(`/dashboard/capture/${data.id}?propertyId=${propertyId}`);
    } else if (type === "cinematic_walkthrough") {
      router.push(`/dashboard/walkthrough/${data.id}?propertyId=${propertyId}`);
    } else {
      router.push(`/dashboard/experiences/builder?type=${type}&id=${data.id}&propertyId=${propertyId}`);
    }
  }

  return (
    <div className="mx-auto max-w-5xl space-y-6 experience-picker">
      <div>
        <h1 className="text-xl font-semibold tracking-tight">Create experience</h1>
        <p className="mt-1 text-sm text-[#71717a]">
          Step 1 — pick a property. Step 2 — click <strong>Next</strong> on any engine to open the builder.
        </p>
      </div>

      <div className="picker-card p-4">
        <label className="picker-section-label">Step 1 · Property</label>
        <select className="studio-input mt-1" value={propertyId} onChange={(e) => setPropertyId(e.target.value)}>
          <option value="">Select property</option>
          {properties.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
        </select>
        {!propertyId && (
          <p className="mt-2 text-xs text-[#a1a1aa]">Choose a property before clicking Next on an engine below.</p>
        )}
      </div>

      <div>
        <p className="picker-section-label mb-3">Step 2 · Choose engine &amp; continue</p>
        <ExperienceTypeSelector
          selected={selected}
          onContinue={continueWithType}
          continuing={creating}
          canContinue={!!propertyId && !creating}
        />
      </div>
    </div>
  );
}
