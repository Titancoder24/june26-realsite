export const PROPERTY_KNOWLEDGE_SECTION_KEYS = [
  "property_name",
  "property_type",
  "location",
  "overview",
  "property_size",
  "rooms",
  "amenities",
  "interior_materials",
  "smart_features",
  "nearby_landmarks",
  "faqs",
  "unknown_answer_rules",
] as const;

export type PropertyKnowledgeSectionKey = (typeof PROPERTY_KNOWLEDGE_SECTION_KEYS)[number];

export type PropertyKnowledgeSectionKind = "single" | "list" | "faq";

export interface PropertyKnowledgeListItem {
  id: string;
  text: string;
  confidence?: number;
  entryId?: string;
}

export interface PropertyKnowledgeFaqItem {
  id: string;
  question: string;
  answer: string;
  confidence?: number;
  entryId?: string;
}

export interface PropertyKnowledgeCustomField {
  id: string;
  label: string;
  value: string;
  confidence?: number;
  entryId?: string;
}

export interface PropertyKnowledgeSection {
  key: PropertyKnowledgeSectionKey;
  label: string;
  kind: PropertyKnowledgeSectionKind;
  confidence?: number;
  value?: string;
  items?: PropertyKnowledgeListItem[];
  faqs?: PropertyKnowledgeFaqItem[];
  customFields?: PropertyKnowledgeCustomField[];
  entryId?: string;
}

export interface StructuredPropertyKnowledge {
  version: 1;
  updated_at: string;
  overall_confidence?: number;
  sections: PropertyKnowledgeSection[];
  raw_extraction?: unknown;
}

export const PROPERTY_KNOWLEDGE_SECTION_DEFS: {
  key: PropertyKnowledgeSectionKey;
  label: string;
  kind: PropertyKnowledgeSectionKind;
}[] = [
  { key: "property_name", label: "Property Name", kind: "single" },
  { key: "property_type", label: "Property Type", kind: "single" },
  { key: "location", label: "Location", kind: "single" },
  { key: "overview", label: "Overview", kind: "single" },
  { key: "property_size", label: "Property Size", kind: "single" },
  { key: "rooms", label: "Rooms", kind: "list" },
  { key: "amenities", label: "Amenities", kind: "list" },
  { key: "interior_materials", label: "Interior Materials", kind: "list" },
  { key: "smart_features", label: "Smart Features", kind: "list" },
  { key: "nearby_landmarks", label: "Nearby Landmarks", kind: "list" },
  { key: "faqs", label: "FAQs", kind: "faq" },
  { key: "unknown_answer_rules", label: "Unknown Answer Rules", kind: "single" },
];

export const LOW_CONFIDENCE_THRESHOLD = 0.65;
