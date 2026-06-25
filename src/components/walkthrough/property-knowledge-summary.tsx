"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  countPopulatedKnowledgeFields,
  formatKnowledgeConfidence,
  isLowConfidence,
  sectionHasContent,
  structuredKnowledgeHasContent,
} from "@/lib/property-knowledge";
import type {
  PropertyKnowledgeCustomField,
  PropertyKnowledgeFaqItem,
  PropertyKnowledgeListItem,
  PropertyKnowledgeSection,
  StructuredPropertyKnowledge,
} from "@/types/property-knowledge";
import { AlertTriangle, Loader2, Plus, Save, Trash2 } from "lucide-react";
import { toast } from "sonner";

function newId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) return crypto.randomUUID();
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

function ConfidenceBadge({ confidence }: { confidence?: number }) {
  const low = isLowConfidence(confidence);
  return (
    <Badge variant={low ? "warning" : "success"} className="shrink-0">
      {low && <AlertTriangle className="mr-1 h-3 w-3" />}
      {formatKnowledgeConfidence(confidence)}
    </Badge>
  );
}

function SectionConfidence({ section }: { section: PropertyKnowledgeSection }) {
  if (section.confidence == null) return null;
  return <ConfidenceBadge confidence={section.confidence} />;
}

function LowConfidenceField({ confidence, children }: { confidence?: number; children: React.ReactNode }) {
  const low = isLowConfidence(confidence);
  return (
    <div className={low ? "wt-pk-field wt-pk-field--low" : "wt-pk-field"} data-low-confidence={low ? "true" : "false"}>
      {children}
    </div>
  );
}

function SingleSectionEditor({
  section,
  editable,
  onChange,
}: {
  section: PropertyKnowledgeSection;
  editable: boolean;
  onChange: (next: PropertyKnowledgeSection) => void;
}) {
  return (
    <LowConfidenceField confidence={section.confidence}>
      {editable ? (
        <textarea
          className="wt-pk-textarea"
          value={section.value ?? ""}
          placeholder={`Enter ${section.label.toLowerCase()}…`}
          onChange={(e) => onChange({ ...section, value: e.target.value, confidence: 1 })}
        />
      ) : (
        <p className="wt-pk-readonly">{section.value?.trim() || "—"}</p>
      )}
    </LowConfidenceField>
  );
}

function ListSectionEditor({
  section,
  editable,
  onChange,
}: {
  section: PropertyKnowledgeSection;
  editable: boolean;
  onChange: (next: PropertyKnowledgeSection) => void;
}) {
  const items = section.items ?? [];

  function updateItem(id: string, text: string) {
    onChange({
      ...section,
      items: items.map((item) => (item.id === id ? { ...item, text, confidence: 1 } : item)),
    });
  }

  function removeItem(id: string) {
    onChange({ ...section, items: items.filter((item) => item.id !== id) });
  }

  function addItem() {
    const item: PropertyKnowledgeListItem = { id: newId(), text: "", confidence: 1 };
    onChange({ ...section, items: [...items, item] });
  }

  if (!editable && !items.length) {
    return <p className="wt-pk-readonly">—</p>;
  }

  return (
    <div className="space-y-2">
      {items.map((item) => (
        <LowConfidenceField key={item.id} confidence={item.confidence ?? section.confidence}>
          <div className="wt-pk-list-row">
            {editable ? (
              <>
                <Input
                  value={item.text}
                  placeholder={`Add ${section.label.toLowerCase()} item…`}
                  onChange={(e) => updateItem(item.id, e.target.value)}
                />
                <Button type="button" size="icon" variant="ghost" onClick={() => removeItem(item.id)}>
                  <Trash2 className="h-4 w-4" />
                </Button>
              </>
            ) : (
              <p className="wt-pk-readonly">{item.text}</p>
            )}
          </div>
        </LowConfidenceField>
      ))}
      {editable && (
        <Button type="button" size="sm" variant="outline" onClick={addItem}>
          <Plus className="mr-1 h-4 w-4" /> Add item
        </Button>
      )}
    </div>
  );
}

function FaqSectionEditor({
  section,
  editable,
  onChange,
}: {
  section: PropertyKnowledgeSection;
  editable: boolean;
  onChange: (next: PropertyKnowledgeSection) => void;
}) {
  const faqs = section.faqs ?? [];

  function updateFaq(id: string, patch: Partial<PropertyKnowledgeFaqItem>) {
    onChange({
      ...section,
      faqs: faqs.map((faq) => (faq.id === id ? { ...faq, ...patch, confidence: 1 } : faq)),
    });
  }

  function removeFaq(id: string) {
    onChange({ ...section, faqs: faqs.filter((faq) => faq.id !== id) });
  }

  function addFaq() {
    const faq: PropertyKnowledgeFaqItem = { id: newId(), question: "", answer: "", confidence: 1 };
    onChange({ ...section, faqs: [...faqs, faq] });
  }

  if (!editable && !faqs.length) {
    return <p className="wt-pk-readonly">—</p>;
  }

  return (
    <div className="space-y-3">
      {faqs.map((faq) => (
        <LowConfidenceField key={faq.id} confidence={faq.confidence ?? section.confidence}>
          <div className="wt-pk-faq-card">
            {editable ? (
              <>
                <Input
                  value={faq.question}
                  placeholder="Question"
                  onChange={(e) => updateFaq(faq.id, { question: e.target.value })}
                />
                <textarea
                  className="wt-pk-textarea"
                  value={faq.answer}
                  placeholder="Answer"
                  onChange={(e) => updateFaq(faq.id, { answer: e.target.value })}
                />
                <Button type="button" size="sm" variant="ghost" onClick={() => removeFaq(faq.id)}>
                  <Trash2 className="mr-1 h-4 w-4" /> Remove FAQ
                </Button>
              </>
            ) : (
              <>
                <p className="font-medium">{faq.question || "—"}</p>
                <p className="wt-pk-readonly">{faq.answer || "—"}</p>
              </>
            )}
          </div>
        </LowConfidenceField>
      ))}
      {editable && (
        <Button type="button" size="sm" variant="outline" onClick={addFaq}>
          <Plus className="mr-1 h-4 w-4" /> Add FAQ
        </Button>
      )}
    </div>
  );
}

function CustomFieldsEditor({
  section,
  editable,
  onChange,
}: {
  section: PropertyKnowledgeSection;
  editable: boolean;
  onChange: (next: PropertyKnowledgeSection) => void;
}) {
  const fields = section.customFields ?? [];

  function updateField(id: string, patch: Partial<PropertyKnowledgeCustomField>) {
    onChange({
      ...section,
      customFields: fields.map((field) => (field.id === id ? { ...field, ...patch, confidence: 1 } : field)),
    });
  }

  function removeField(id: string) {
    onChange({ ...section, customFields: fields.filter((field) => field.id !== id) });
  }

  function addField() {
    const field: PropertyKnowledgeCustomField = { id: newId(), label: "Custom field", value: "", confidence: 1 };
    onChange({ ...section, customFields: [...fields, field] });
  }

  if (!fields.length && !editable) return null;

  return (
    <div className="wt-pk-custom-fields">
      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Custom fields</p>
      {fields.map((field) => (
        <LowConfidenceField key={field.id} confidence={field.confidence}>
          <div className="wt-pk-custom-row">
            {editable ? (
              <>
                <Input
                  value={field.label}
                  placeholder="Field label"
                  onChange={(e) => updateField(field.id, { label: e.target.value })}
                />
                <Input
                  value={field.value}
                  placeholder="Value"
                  onChange={(e) => updateField(field.id, { value: e.target.value })}
                />
                <Button type="button" size="icon" variant="ghost" onClick={() => removeField(field.id)}>
                  <Trash2 className="h-4 w-4" />
                </Button>
              </>
            ) : (
              <p className="wt-pk-readonly">
                <span className="font-medium">{field.label}:</span> {field.value || "—"}
              </p>
            )}
          </div>
        </LowConfidenceField>
      ))}
      {editable && (
        <Button type="button" size="sm" variant="outline" onClick={addField}>
          <Plus className="mr-1 h-4 w-4" /> Add custom field
        </Button>
      )}
    </div>
  );
}

export function PropertyKnowledgeSummary({
  propertyId,
  experienceId,
  knowledge,
  onKnowledgeChange,
  mode = "edit",
  showToggles = true,
  title = "Property Knowledge Summary",
  description,
}: {
  propertyId: string;
  experienceId?: string;
  knowledge: StructuredPropertyKnowledge | null;
  onKnowledgeChange?: (next: StructuredPropertyKnowledge) => void;
  mode?: "edit" | "preview";
  showToggles?: boolean;
  title?: string;
  description?: string;
}) {
  const editable = mode === "edit";
  const [draft, setDraft] = useState<StructuredPropertyKnowledge | null>(knowledge);
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [viewMode, setViewMode] = useState<"structured" | "raw">("structured");

  useEffect(() => {
    setDraft(knowledge);
    setDirty(false);
  }, [knowledge]);

  const populatedCount = useMemo(
    () => (draft ? countPopulatedKnowledgeFields(draft) : 0),
    [draft],
  );

  const defaultOpenSections = useMemo(
    () => (draft?.sections.filter(sectionHasContent).map((s) => s.key) ?? []),
    [draft],
  );

  const updateSection = useCallback((key: string, next: PropertyKnowledgeSection) => {
    setDraft((prev) => {
      if (!prev) return prev;
      const updated = {
        ...prev,
        sections: prev.sections.map((section) => (section.key === key ? next : section)),
        updated_at: new Date().toISOString(),
      };
      setDirty(true);
      return updated;
    });
  }, []);

  async function persist() {
    if (!draft) return;
    setSaving(true);
    try {
      const res = await fetch("/api/walkthrough/rag/knowledge", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          property_id: propertyId,
          experience_id: experienceId,
          structured_knowledge: draft,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed to save knowledge");
      setDraft(data.structured_knowledge);
      onKnowledgeChange?.(data.structured_knowledge);
      setDirty(false);
      toast.success("Property knowledge saved — AI assistant will use your edits");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Save failed");
    } finally {
      setSaving(false);
    }
  }

  if (!draft) {
    if (mode === "preview") {
      return (
        <div className="wt-pk-summary wt-pk-summary--empty">
          <h3 className="font-medium">{title}</h3>
          <p className="text-sm text-muted-foreground">No property knowledge has been added yet.</p>
        </div>
      );
    }
    return null;
  }

  if (mode === "preview" && !structuredKnowledgeHasContent(draft)) {
    return (
      <div className="wt-pk-summary wt-pk-summary--empty">
        <h3 className="font-medium">{title}</h3>
        <p className="text-sm text-muted-foreground">No property knowledge has been added yet.</p>
      </div>
    );
  }

  return (
    <div className="wt-pk-summary">
      <div className="wt-pk-summary-header">
        <div>
          <h3 className="font-medium">{title}</h3>
          {description && <p className="text-sm text-muted-foreground">{description}</p>}
        </div>
        <div className="wt-pk-summary-meta">
          {draft.overall_confidence != null && (
            <Badge variant={isLowConfidence(draft.overall_confidence) ? "warning" : "secondary"}>
              Extraction confidence {formatKnowledgeConfidence(draft.overall_confidence)}
            </Badge>
          )}
          <Badge variant="outline">{populatedCount} fields</Badge>
        </div>
      </div>

      {showToggles && (
        <div className="wt-pk-view-toggle">
          <Button
            type="button"
            size="sm"
            variant={viewMode === "structured" ? "default" : "outline"}
            onClick={() => setViewMode("structured")}
          >
            View Structured Knowledge
          </Button>
          <Button
            type="button"
            size="sm"
            variant={viewMode === "raw" ? "default" : "outline"}
            onClick={() => setViewMode("raw")}
          >
            View Raw Knowledge
          </Button>
        </div>
      )}

      {viewMode === "raw" ? (
        <pre className="wt-pk-raw">{JSON.stringify(draft.raw_extraction ?? draft, null, 2)}</pre>
      ) : (
        <Accordion type="multiple" defaultValue={defaultOpenSections} className="wt-pk-accordion">
          {draft.sections.map((section) => {
            const hasContent = sectionHasContent(section);
            if (mode === "preview" && !hasContent) return null;

            return (
              <AccordionItem key={section.key} value={section.key} className="wt-pk-section">
                <AccordionTrigger className="wt-pk-section-trigger">
                  <span className="flex flex-1 items-center justify-between gap-3 pr-2">
                    <span className="flex items-center gap-2">
                      {section.label}
                      {isLowConfidence(section.confidence) && hasContent && (
                        <AlertTriangle className="h-3.5 w-3.5 text-amber-600" />
                      )}
                    </span>
                    <SectionConfidence section={section} />
                  </span>
                </AccordionTrigger>
                <AccordionContent>
                  {section.kind === "single" && (
                    <SingleSectionEditor
                      section={section}
                      editable={editable}
                      onChange={(next) => updateSection(section.key, next)}
                    />
                  )}
                  {section.kind === "list" && (
                    <ListSectionEditor
                      section={section}
                      editable={editable}
                      onChange={(next) => updateSection(section.key, next)}
                    />
                  )}
                  {section.kind === "faq" && (
                    <FaqSectionEditor
                      section={section}
                      editable={editable}
                      onChange={(next) => updateSection(section.key, next)}
                    />
                  )}
                  <CustomFieldsEditor
                    section={section}
                    editable={editable}
                    onChange={(next) => updateSection(section.key, next)}
                  />
                </AccordionContent>
              </AccordionItem>
            );
          })}
        </Accordion>
      )}

      {editable && viewMode === "structured" && (
        <div className="wt-pk-actions">
          <p className="text-xs text-muted-foreground">
            Review low-confidence fields (highlighted in amber) before publishing.
          </p>
          <Button type="button" onClick={persist} disabled={saving || !dirty}>
            {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
            Save knowledge
          </Button>
        </div>
      )}
    </div>
  );
}
