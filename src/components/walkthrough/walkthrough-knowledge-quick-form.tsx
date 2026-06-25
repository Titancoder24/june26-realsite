"use client";

import { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  createEmptyStructuredPropertyKnowledge,
  normalizeStructuredPropertyKnowledge,
} from "@/lib/property-knowledge";
import type { PropertyKnowledgeSectionKey, StructuredPropertyKnowledge } from "@/types/property-knowledge";
import { Loader2, Save } from "lucide-react";
import { toast } from "sonner";

function readSectionValue(knowledge: StructuredPropertyKnowledge | null, key: PropertyKnowledgeSectionKey): string {
  if (!knowledge) return "";
  const section = knowledge.sections.find((s) => s.key === key);
  if (!section) return "";
  if (section.kind === "list") {
    return (section.items ?? []).map((i) => i.text).filter(Boolean).join(", ");
  }
  return section.value?.trim() ?? "";
}

function newId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) return crypto.randomUUID();
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

function writeSectionValue(
  knowledge: StructuredPropertyKnowledge,
  key: PropertyKnowledgeSectionKey,
  value: string,
) {
  const section = knowledge.sections.find((s) => s.key === key);
  if (!section) return;
  const trimmed = value.trim();
  if (!trimmed) return;

  if (section.kind === "list") {
    section.items = trimmed.split(/[,;\n]+/).map((text) => text.trim()).filter(Boolean).map((text) => ({
      id: newId(),
      text,
      confidence: 1,
    }));
    section.confidence = 1;
    return;
  }

  section.value = trimmed;
  section.confidence = 1;
}

export function WalkthroughKnowledgeQuickForm({
  propertyId,
  experienceId,
  onKnowledgeChange,
}: {
  propertyId: string;
  experienceId: string;
  onKnowledgeChange?: (knowledge: StructuredPropertyKnowledge | null) => void;
}) {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [draft, setDraft] = useState<StructuredPropertyKnowledge | null>(null);
  const [overview, setOverview] = useState("");
  const [sizeAndPrice, setSizeAndPrice] = useState("");
  const [amenities, setAmenities] = useState("");

  const loadKnowledge = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/walkthrough/rag/knowledge?propertyId=${propertyId}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed to load knowledge");
      const knowledge = data.structured_knowledge
        ? normalizeStructuredPropertyKnowledge(data.structured_knowledge)
        : null;
      setDraft(knowledge);
      setOverview(readSectionValue(knowledge, "overview"));
      setSizeAndPrice(readSectionValue(knowledge, "property_size"));
      setAmenities(readSectionValue(knowledge, "amenities"));
      onKnowledgeChange?.(knowledge);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to load property knowledge");
    } finally {
      setLoading(false);
    }
  }, [propertyId, onKnowledgeChange]);

  useEffect(() => {
    loadKnowledge();
  }, [loadKnowledge]);

  async function save() {
    setSaving(true);
    try {
      const base = draft ?? createEmptyStructuredPropertyKnowledge();
      writeSectionValue(base, "overview", overview);
      writeSectionValue(base, "property_size", sizeAndPrice);
      writeSectionValue(base, "amenities", amenities);

      const res = await fetch("/api/walkthrough/rag/knowledge", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          property_id: propertyId,
          experience_id: experienceId,
          structured_knowledge: base,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed to save");

      const saved = normalizeStructuredPropertyKnowledge(data.structured_knowledge);
      setDraft(saved);
      onKnowledgeChange?.(saved);
      toast.success("Property details saved");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to save");
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="wt-card flex items-center gap-2 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" /> Loading…
      </div>
    );
  }

  return (
    <div className="wt-card space-y-4">
      <div>
        <h3 className="font-medium">Property details (optional)</h3>
        <p className="text-sm text-muted-foreground">
          Add a quick summary for the AI assistant. Scene descriptions are already included automatically — you can skip this and launch immediately.
        </p>
      </div>
      <div className="space-y-3">
        <div>
          <Label htmlFor="wt-overview">Overview</Label>
          <textarea
            id="wt-overview"
            className="wt-pk-textarea mt-1"
            rows={3}
            placeholder="e.g. Premium 3BHK with skyline views, ready to move in…"
            value={overview}
            onChange={(e) => setOverview(e.target.value)}
          />
        </div>
        <div>
          <Label htmlFor="wt-size">Price & size</Label>
          <Input
            id="wt-size"
            className="mt-1"
            placeholder="e.g. ₹1.4 Cr · 1650 sq ft · Dec 2027 possession"
            value={sizeAndPrice}
            onChange={(e) => setSizeAndPrice(e.target.value)}
          />
        </div>
        <div>
          <Label htmlFor="wt-amenities">Amenities</Label>
          <Input
            id="wt-amenities"
            className="mt-1"
            placeholder="e.g. Gym, pool, clubhouse, parking"
            value={amenities}
            onChange={(e) => setAmenities(e.target.value)}
          />
        </div>
      </div>
      <Button type="button" variant="outline" onClick={save} disabled={saving}>
        {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
        Save details
      </Button>
    </div>
  );
}
