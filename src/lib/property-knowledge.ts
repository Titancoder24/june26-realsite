import {
  LOW_CONFIDENCE_THRESHOLD,
  PROPERTY_KNOWLEDGE_SECTION_DEFS,
  type PropertyKnowledgeFaqItem,
  type PropertyKnowledgeListItem,
  type PropertyKnowledgeSection,
  type PropertyKnowledgeSectionKey,
  type StructuredPropertyKnowledge,
} from "@/types/property-knowledge";

function newId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) return crypto.randomUUID();
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

function clampConfidence(value: unknown): number | undefined {
  const n = Number(value);
  if (!Number.isFinite(n)) return undefined;
  return Math.min(1, Math.max(0, n));
}

function asString(value: unknown): string {
  if (value == null) return "";
  if (typeof value === "string") return value.trim();
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  return "";
}

function parseListItems(raw: unknown): PropertyKnowledgeListItem[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((item) => {
      if (typeof item === "string") {
        const text = item.trim();
        return text ? { id: newId(), text, confidence: 0.75 } : null;
      }
      if (item && typeof item === "object") {
        const obj = item as Record<string, unknown>;
        const text = asString(obj.text ?? obj.value ?? obj.name ?? obj.label);
        if (!text) return null;
        return {
          id: newId(),
          text,
          confidence: clampConfidence(obj.confidence),
        };
      }
      return null;
    })
    .filter(Boolean) as PropertyKnowledgeListItem[];
}

function parseFaqItems(raw: unknown): PropertyKnowledgeFaqItem[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((item) => {
      if (!item || typeof item !== "object") return null;
      const obj = item as Record<string, unknown>;
      const question = asString(obj.question ?? obj.q);
      const answer = asString(obj.answer ?? obj.a);
      if (!question && !answer) return null;
      return {
        id: newId(),
        question,
        answer,
        confidence: clampConfidence(obj.confidence),
      };
    })
    .filter(Boolean) as PropertyKnowledgeFaqItem[];
}

function emptySection(def: (typeof PROPERTY_KNOWLEDGE_SECTION_DEFS)[number]): PropertyKnowledgeSection {
  return {
    key: def.key,
    label: def.label,
    kind: def.kind,
    ...(def.kind === "single" ? { value: "" } : {}),
    ...(def.kind === "list" ? { items: [] } : {}),
    ...(def.kind === "faq" ? { faqs: [] } : {}),
    customFields: [],
  };
}

export function createEmptyStructuredPropertyKnowledge(): StructuredPropertyKnowledge {
  return {
    version: 1,
    updated_at: new Date().toISOString(),
    sections: PROPERTY_KNOWLEDGE_SECTION_DEFS.map(emptySection),
  };
}

function parseSectionFromExtraction(
  key: PropertyKnowledgeSectionKey,
  def: (typeof PROPERTY_KNOWLEDGE_SECTION_DEFS)[number],
  raw: unknown,
): PropertyKnowledgeSection {
  const base = emptySection(def);
  if (!raw || typeof raw !== "object") return base;

  const obj = raw as Record<string, unknown>;
  const confidence = clampConfidence(obj.confidence);

  if (def.kind === "single") {
    const value = asString(obj.value ?? obj.text ?? obj.content);
    if (!value) return base;
    return { ...base, value, confidence: confidence ?? 0.75 };
  }

  if (def.kind === "list") {
    const items = parseListItems(obj.items ?? obj.values ?? obj.list ?? obj);
    if (!items.length) return base;
    const itemConfidences = items.map((i) => i.confidence).filter((c): c is number => c != null);
    const avg = itemConfidences.length
      ? itemConfidences.reduce((a, b) => a + b, 0) / itemConfidences.length
      : confidence ?? 0.75;
    return { ...base, items, confidence: avg };
  }

  const faqs = parseFaqItems(obj.items ?? obj.faqs ?? obj);
  if (!faqs.length) return base;
  const faqConfidences = faqs.map((f) => f.confidence).filter((c): c is number => c != null);
  const avg = faqConfidences.length
    ? faqConfidences.reduce((a, b) => a + b, 0) / faqConfidences.length
    : confidence ?? 0.75;
  return { ...base, faqs, confidence: avg };
}

export function parseStructuredPropertyKnowledgeFromExtraction(
  raw: unknown,
  rawExtraction?: unknown,
): StructuredPropertyKnowledge {
  const structured = createEmptyStructuredPropertyKnowledge();
  if (!raw || typeof raw !== "object") {
    structured.raw_extraction = rawExtraction ?? raw;
    return structured;
  }

  const obj = raw as Record<string, unknown>;
  structured.overall_confidence = clampConfidence(obj.overall_confidence);
  structured.raw_extraction = rawExtraction ?? raw;

  structured.sections = PROPERTY_KNOWLEDGE_SECTION_DEFS.map((def) =>
    parseSectionFromExtraction(def.key, def, obj[def.key]),
  );

  if (structured.overall_confidence == null) {
    const confidences = structured.sections
      .map((s) => s.confidence)
      .filter((c): c is number => c != null);
    if (confidences.length) {
      structured.overall_confidence = confidences.reduce((a, b) => a + b, 0) / confidences.length;
    }
  }

  structured.updated_at = new Date().toISOString();
  return structured;
}

function mergeListItems(existing: PropertyKnowledgeListItem[] = [], incoming: PropertyKnowledgeListItem[] = []) {
  const seen = new Set(existing.map((i) => i.text.toLowerCase()));
  const merged = [...existing];
  for (const item of incoming) {
    const key = item.text.toLowerCase();
    if (!key || seen.has(key)) continue;
    seen.add(key);
    merged.push({ ...item, id: item.id || newId() });
  }
  return merged;
}

function mergeFaqs(existing: PropertyKnowledgeFaqItem[] = [], incoming: PropertyKnowledgeFaqItem[] = []) {
  const seen = new Set(existing.map((f) => `${f.question}|${f.answer}`.toLowerCase()));
  const merged = [...existing];
  for (const faq of incoming) {
    const key = `${faq.question}|${faq.answer}`.toLowerCase();
    if (!key.trim() || seen.has(key)) continue;
    seen.add(key);
    merged.push({ ...faq, id: faq.id || newId() });
  }
  return merged;
}

export function mergeStructuredPropertyKnowledge(
  existing: StructuredPropertyKnowledge | null | undefined,
  incoming: StructuredPropertyKnowledge,
): StructuredPropertyKnowledge {
  const base = existing ?? createEmptyStructuredPropertyKnowledge();
  const byKey = new Map(base.sections.map((s) => [s.key, s]));

  const sections = PROPERTY_KNOWLEDGE_SECTION_DEFS.map((def) => {
    const prev = byKey.get(def.key) ?? emptySection(def);
    const next = incoming.sections.find((s) => s.key === def.key) ?? emptySection(def);

    if (def.kind === "single") {
      const value = next.value?.trim() ? next.value : prev.value;
      return {
        ...prev,
        value,
        confidence: next.value?.trim() ? next.confidence ?? prev.confidence : prev.confidence,
        entryId: next.value?.trim() ? next.entryId ?? prev.entryId : prev.entryId,
        customFields: [...(prev.customFields ?? []), ...(next.customFields ?? [])],
      };
    }

    if (def.kind === "list") {
      return {
        ...prev,
        items: mergeListItems(prev.items, next.items),
        confidence: next.confidence ?? prev.confidence,
        customFields: [...(prev.customFields ?? []), ...(next.customFields ?? [])],
      };
    }

    return {
      ...prev,
      faqs: mergeFaqs(prev.faqs, next.faqs),
      confidence: next.confidence ?? prev.confidence,
      customFields: [...(prev.customFields ?? []), ...(next.customFields ?? [])],
    };
  });

  const confidences = sections.map((s) => s.confidence).filter((c): c is number => c != null);
  return {
    version: 1,
    updated_at: new Date().toISOString(),
    overall_confidence: incoming.overall_confidence ?? (confidences.length
      ? confidences.reduce((a, b) => a + b, 0) / confidences.length
      : base.overall_confidence),
    sections,
    raw_extraction: incoming.raw_extraction ?? base.raw_extraction,
  };
}

export function normalizeStructuredPropertyKnowledge(raw: unknown): StructuredPropertyKnowledge {
  if (!raw || typeof raw !== "object") return createEmptyStructuredPropertyKnowledge();
  const obj = raw as Partial<StructuredPropertyKnowledge>;
  if (!Array.isArray(obj.sections)) return createEmptyStructuredPropertyKnowledge();

  const byKey = new Map(obj.sections.map((s) => [s.key, s]));
  const sections = PROPERTY_KNOWLEDGE_SECTION_DEFS.map((def) => {
    const section = byKey.get(def.key);
    if (!section) return emptySection(def);
    return {
      ...emptySection(def),
      ...section,
      customFields: section.customFields ?? [],
      items: section.items ?? [],
      faqs: section.faqs ?? [],
    };
  });

  return {
    version: 1,
    updated_at: obj.updated_at ?? new Date().toISOString(),
    overall_confidence: clampConfidence(obj.overall_confidence),
    sections,
    raw_extraction: obj.raw_extraction,
  };
}

export function sectionHasContent(section: PropertyKnowledgeSection): boolean {
  if (section.kind === "single" && section.value?.trim()) return true;
  if (section.kind === "list" && (section.items?.length ?? 0) > 0) return true;
  if (section.kind === "faq" && (section.faqs?.length ?? 0) > 0) return true;
  if ((section.customFields?.length ?? 0) > 0) return true;
  return false;
}

export function structuredKnowledgeHasContent(knowledge: StructuredPropertyKnowledge): boolean {
  return knowledge.sections.some(sectionHasContent);
}

export function formatKnowledgeConfidence(confidence?: number): string {
  if (confidence == null || Number.isNaN(confidence)) return "—";
  return `${Math.round(confidence * 100)}%`;
}

export function isLowConfidence(confidence?: number): boolean {
  return confidence == null || confidence < LOW_CONFIDENCE_THRESHOLD;
}

export function ragCategoryForSection(key: PropertyKnowledgeSectionKey): string {
  switch (key) {
    case "amenities":
    case "smart_features":
      return "amenities";
    case "faqs":
      return "faq";
    case "unknown_answer_rules":
      return "legal";
    case "property_size":
    case "rooms":
    case "interior_materials":
      return "unit_details";
    default:
      return "project_details";
  }
}

export interface RagEntryDraft {
  sectionKey: PropertyKnowledgeSectionKey;
  fieldId: string;
  category: string;
  title: string;
  content: string;
  entryId?: string;
}

export function structuredKnowledgeToRagDrafts(knowledge: StructuredPropertyKnowledge): RagEntryDraft[] {
  const drafts: RagEntryDraft[] = [];

  for (const section of knowledge.sections) {
    const category = ragCategoryForSection(section.key);

    if (section.kind === "single" && section.value?.trim()) {
      drafts.push({
        sectionKey: section.key,
        fieldId: section.key,
        category,
        title: section.label,
        content: section.value.trim(),
        entryId: section.entryId,
      });
    }

    if (section.kind === "list") {
      for (const item of section.items ?? []) {
        if (!item.text.trim()) continue;
        drafts.push({
          sectionKey: section.key,
          fieldId: item.id,
          category,
          title: `${section.label}: ${item.text.slice(0, 80)}`,
          content: item.text.trim(),
          entryId: item.entryId,
        });
      }
    }

    if (section.kind === "faq") {
      for (const faq of section.faqs ?? []) {
        if (!faq.question.trim() && !faq.answer.trim()) continue;
        drafts.push({
          sectionKey: section.key,
          fieldId: faq.id,
          category,
          title: faq.question.trim() || "FAQ",
          content: faq.answer.trim() ? `Q: ${faq.question.trim()}\nA: ${faq.answer.trim()}` : faq.question.trim(),
          entryId: faq.entryId,
        });
      }
    }

    for (const custom of section.customFields ?? []) {
      if (!custom.value.trim()) continue;
      drafts.push({
        sectionKey: section.key,
        fieldId: custom.id,
        category,
        title: custom.label.trim() || `${section.label} detail`,
        content: custom.value.trim(),
        entryId: custom.entryId,
      });
    }
  }

  return drafts;
}

/** Compact text summary for Samvaad agent_variables (owner-approved knowledge). */
export function structuredKnowledgeToPromptSummary(
  knowledge: StructuredPropertyKnowledge,
  maxChars = 6000,
): string {
  const lines: string[] = [];
  for (const section of knowledge.sections) {
    if (!sectionHasContent(section)) continue;
    if (section.kind === "single" && section.value?.trim()) {
      lines.push(`${section.label}: ${section.value.trim()}`);
    }
    if (section.kind === "list") {
      const items = (section.items ?? []).map((i) => i.text.trim()).filter(Boolean);
      if (items.length) lines.push(`${section.label}: ${items.join("; ")}`);
    }
    if (section.kind === "faq") {
      for (const faq of section.faqs ?? []) {
        if (!faq.question.trim() && !faq.answer.trim()) continue;
        lines.push(`FAQ — ${faq.question.trim()}: ${faq.answer.trim()}`);
      }
    }
    for (const custom of section.customFields ?? []) {
      if (!custom.value.trim()) continue;
      lines.push(`${custom.label.trim() || section.label}: ${custom.value.trim()}`);
    }
  }
  const text = lines.join("\n");
  if (text.length <= maxChars) return text;
  return `${text.slice(0, maxChars - 3)}...`;
}

export function attachEntryIdsToStructuredKnowledge(
  knowledge: StructuredPropertyKnowledge,
  entryMap: Map<string, string>,
): StructuredPropertyKnowledge {
  return {
    ...knowledge,
    sections: knowledge.sections.map((section) => {
      if (section.kind === "single") {
        return { ...section, entryId: entryMap.get(`${section.key}:${section.key}`) ?? section.entryId };
      }
      if (section.kind === "list") {
        return {
          ...section,
          items: (section.items ?? []).map((item) => ({
            ...item,
            entryId: entryMap.get(`${section.key}:${item.id}`) ?? item.entryId,
          })),
        };
      }
      if (section.kind === "faq") {
        return {
          ...section,
          faqs: (section.faqs ?? []).map((faq) => ({
            ...faq,
            entryId: entryMap.get(`${section.key}:${faq.id}`) ?? faq.entryId,
          })),
        };
      }
      return {
        ...section,
        customFields: (section.customFields ?? []).map((field) => ({
          ...field,
          entryId: entryMap.get(`${section.key}:${field.id}`) ?? field.entryId,
        })),
      };
    }),
  };
}

export function countPopulatedKnowledgeFields(knowledge: StructuredPropertyKnowledge): number {
  let count = 0;
  for (const section of knowledge.sections) {
    if (section.kind === "single" && section.value?.trim()) count += 1;
    if (section.kind === "list") count += (section.items ?? []).filter((i) => i.text.trim()).length;
    if (section.kind === "faq") count += (section.faqs ?? []).filter((f) => f.question.trim() || f.answer.trim()).length;
    count += (section.customFields ?? []).filter((f) => f.value.trim()).length;
  }
  return count;
}
