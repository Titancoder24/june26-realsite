"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import {
  countPopulatedKnowledgeFields,
  sectionHasContent,
  structuredKnowledgeHasContent,
} from "@/lib/property-knowledge";
import type {
  PropertyKnowledgeSection,
  StructuredPropertyKnowledge,
} from "@/types/property-knowledge";
import { AnimatePresence, motion } from "motion/react";
import {
  CheckCircle2,
  FileText,
  Loader2,
  Pencil,
  RefreshCw,
  Sparkles,
  Trash2,
  Upload,
} from "lucide-react";
import { toast } from "sonner";

type PipelineStep = "extracting" | "embedding" | "saving" | "ready";

const PIPELINE: { key: PipelineStep; label: string }[] = [
  { key: "extracting", label: "Extracting brochure…" },
  { key: "embedding", label: "Generating embeddings…" },
  { key: "saving", label: "Saving knowledge…" },
  { key: "ready", label: "Voice Agent Ready ✓" },
];

const CARD_TITLES: Record<string, string> = {
  overview: "Property Overview",
  property_name: "Property Name",
  property_type: "Property Type",
  location: "Location",
  property_size: "Specifications",
  rooms: "Rooms & Layout",
  amenities: "Amenities",
  interior_materials: "Interior & Flooring",
  smart_features: "Smart Features",
  nearby_landmarks: "Nearby Places",
  faqs: "FAQs",
};

type PendingFile = {
  kind: "brochure" | "pamphlet";
  name: string;
  mime: string;
  data_base64?: string;
  text?: string;
};

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      resolve(result.includes(",") ? result.split(",")[1]! : result);
    };
    reader.onerror = () => reject(new Error("Failed to read file"));
    reader.readAsDataURL(file);
  });
}

async function readUpload(file: File): Promise<PendingFile["data_base64"] | PendingFile["text"]> {
  const isPdf = file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf");
  if (isPdf) return fileToBase64(file);
  return file.text();
}

function sectionDisplayText(section: PropertyKnowledgeSection): string {
  if (section.kind === "single") return section.value?.trim() ?? "";
  if (section.kind === "list") {
    return (section.items ?? []).map((i) => i.text).filter(Boolean).join(" · ");
  }
  if (section.kind === "faq") {
    return (section.faqs ?? [])
      .map((f) => (f.question && f.answer ? `${f.question}: ${f.answer}` : f.question || f.answer))
      .filter(Boolean)
      .join("\n");
  }
  return "";
}

function StatusBar({ step }: { step: PipelineStep | null }) {
  if (!step) return null;
  const idx = PIPELINE.findIndex((p) => p.key === step);

  return (
    <motion.div
      initial={{ opacity: 0, y: -4 }}
      animate={{ opacity: 1, y: 0 }}
      className="wt-wpk-status"
    >
      {PIPELINE.map((p, i) => (
        <span
          key={p.key}
          className="wt-wpk-status-step"
          data-active={i === idx}
          data-done={i < idx}
        >
          {i < idx ? <CheckCircle2 className="h-3.5 w-3.5" /> : i === idx ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
          {p.label}
        </span>
      ))}
    </motion.div>
  );
}

function KnowledgeCard({
  title,
  content,
  onEdit,
  onDelete,
  onRegenerate,
  busy,
}: {
  title: string;
  content: string;
  onEdit: () => void;
  onDelete: () => void;
  onRegenerate: () => void;
  busy?: boolean;
}) {
  return (
    <motion.article
      layout
      initial={{ opacity: 0, scale: 0.98 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.98 }}
      className="wt-wpk-card"
    >
      <h3 className="wt-wpk-card-title">{title}</h3>
      <p className="wt-wpk-card-body">{content}</p>
      <div className="wt-wpk-card-actions">
        <Button type="button" size="sm" variant="ghost" onClick={onEdit} disabled={busy}>
          <Pencil className="mr-1 h-3.5 w-3.5" /> Edit
        </Button>
        <Button type="button" size="sm" variant="ghost" onClick={onRegenerate} disabled={busy}>
          <RefreshCw className="mr-1 h-3.5 w-3.5" /> Regenerate
        </Button>
        <Button type="button" size="sm" variant="ghost" className="text-destructive" onClick={onDelete} disabled={busy}>
          <Trash2 className="mr-1 h-3.5 w-3.5" /> Delete
        </Button>
      </div>
    </motion.article>
  );
}

export function WalkthroughPropertyKnowledgePanel({
  experienceId,
  propertyId,
  onKnowledgeChange,
}: {
  experienceId: string;
  propertyId: string;
  onKnowledgeChange?: (knowledge: StructuredPropertyKnowledge | null) => void;
}) {
  const [text, setText] = useState("");
  const [brochure, setBrochure] = useState<PendingFile | null>(null);
  const [pamphlet, setPamphlet] = useState<PendingFile | null>(null);
  const [uploadProgress, setUploadProgress] = useState<number | null>(null);
  const [pipelineStep, setPipelineStep] = useState<PipelineStep | null>(null);
  const [saving, setSaving] = useState(false);
  const [readiness, setReadiness] = useState(0);
  const [knowledge, setKnowledge] = useState<StructuredPropertyKnowledge | null>(null);
  const [loading, setLoading] = useState(true);
  const [editingSection, setEditingSection] = useState<PropertyKnowledgeSection | null>(null);
  const [editDraft, setEditDraft] = useState("");
  const dropRef = useRef<HTMLDivElement>(null);
  const [dragOver, setDragOver] = useState(false);

  const loadKnowledge = useCallback(async () => {
    setLoading(true);
    try {
      const [kRes, rRes] = await Promise.all([
        fetch(`/api/walkthrough/rag/knowledge?propertyId=${propertyId}`),
        fetch(`/api/knowledge?propertyId=${propertyId}`),
      ]);
      const kData = await kRes.json();
      const rData = await rRes.json();
      if (kRes.ok) {
        setKnowledge(kData.structured_knowledge ?? null);
        onKnowledgeChange?.(kData.structured_knowledge ?? null);
      }
      if (rRes.ok) setReadiness(rData.readiness?.overall ?? 0);
    } catch {
      toast.error("Could not load property knowledge");
    } finally {
      setLoading(false);
    }
  }, [propertyId, onKnowledgeChange]);

  useEffect(() => {
    void loadKnowledge();
  }, [loadKnowledge]);

  async function assignFile(file: File, kind: "brochure" | "pamphlet") {
    const lower = file.name.toLowerCase();
    const isPdf = file.type === "application/pdf" || lower.endsWith(".pdf");
    const isText =
      file.type.startsWith("text/")
      || lower.endsWith(".txt")
      || lower.endsWith(".md")
      || lower.endsWith(".csv")
      || lower.endsWith(".json");

    if (!isPdf && !isText) {
      toast.error("Use PDF or text files.");
      return;
    }

    setUploadProgress(0);
    const tick = window.setInterval(() => {
      setUploadProgress((p) => (p == null ? 10 : Math.min(95, p + 12)));
    }, 120);

    try {
      const payload = await readUpload(file);
      const entry: PendingFile = {
        kind,
        name: file.name,
        mime: file.type || (isPdf ? "application/pdf" : "text/plain"),
        ...(typeof payload === "string" && !isPdf ? { text: payload } : { data_base64: payload as string }),
      };
      if (kind === "brochure") setBrochure(entry);
      else setPamphlet(entry);
      setUploadProgress(100);
      toast.success(`${kind === "brochure" ? "Brochure" : "Pamphlet"} attached`);
    } catch {
      toast.error(`Could not read ${file.name}`);
    } finally {
      window.clearInterval(tick);
      window.setTimeout(() => setUploadProgress(null), 600);
    }
  }

  function onDrop(e: React.DragEvent) {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files?.[0];
    if (file) void assignFile(file, "brochure");
  }

  async function persistKnowledge(next: StructuredPropertyKnowledge) {
    const res = await fetch("/api/walkthrough/rag/knowledge", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        property_id: propertyId,
        experience_id: experienceId,
        structured_knowledge: next,
      }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error ?? "Save failed");
    setKnowledge(data.structured_knowledge);
    onKnowledgeChange?.(data.structured_knowledge);
    const rRes = await fetch(`/api/knowledge?propertyId=${propertyId}`);
    const rData = await rRes.json();
    if (rRes.ok) setReadiness(rData.readiness?.overall ?? 0);
    return data.structured_knowledge as StructuredPropertyKnowledge;
  }

  async function handleSave() {
    if (!text.trim() && !brochure && !pamphlet) {
      toast.error("Paste property details or upload a brochure/pamphlet.");
      return;
    }

    setSaving(true);
    setPipelineStep("extracting");
    const t1 = window.setTimeout(() => setPipelineStep("embedding"), 900);
    const t2 = window.setTimeout(() => setPipelineStep("saving"), 1800);

    const attachments = [brochure, pamphlet]
      .filter(Boolean)
      .map((f) => ({
        name: f!.name,
        mime: f!.mime,
        text: f!.text,
        data_base64: f!.data_base64,
      }));

    try {
      const res = await fetch("/api/knowledge/ingest", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          property_id: propertyId,
          experience_id: experienceId,
          message: text.trim(),
          attachments,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Save failed");

      window.clearTimeout(t1);
      window.clearTimeout(t2);
      setPipelineStep("ready");

      if (data.structured_knowledge) {
        setKnowledge(data.structured_knowledge);
        onKnowledgeChange?.(data.structured_knowledge);
      }
      await loadKnowledge();
      setText("");
      setBrochure(null);
      setPamphlet(null);
      toast.success("Property knowledge saved — voice agent is ready");
    } catch (e) {
      window.clearTimeout(t1);
      window.clearTimeout(t2);
      setPipelineStep(null);
      toast.error(e instanceof Error ? e.message : "Save failed");
    } finally {
      setSaving(false);
      window.setTimeout(() => setPipelineStep(null), 2500);
    }
  }

  async function deleteSection(section: PropertyKnowledgeSection) {
    if (!knowledge) return;
    const cleared: PropertyKnowledgeSection = {
      ...section,
      value: section.kind === "single" ? "" : undefined,
      items: section.kind === "list" ? [] : section.items,
      faqs: section.kind === "faq" ? [] : section.faqs,
      confidence: undefined,
    };
    const next = {
      ...knowledge,
      sections: knowledge.sections.map((s) => (s.key === section.key ? cleared : s)),
      updated_at: new Date().toISOString(),
    };
    try {
      await persistKnowledge(next);
      toast.success("Section removed");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Delete failed");
    }
  }

  async function saveEdit() {
    if (!knowledge || !editingSection) return;
    const nextSection: PropertyKnowledgeSection =
      editingSection.kind === "single"
        ? { ...editingSection, value: editDraft, confidence: 1 }
        : editingSection.kind === "list"
          ? {
              ...editingSection,
              items: editDraft.split("\n").filter(Boolean).map((line) => ({
                id: crypto.randomUUID(),
                text: line.trim(),
                confidence: 1,
              })),
              confidence: 1,
            }
          : editingSection;

    const next = {
      ...knowledge,
      sections: knowledge.sections.map((s) => (s.key === editingSection.key ? nextSection : s)),
      updated_at: new Date().toISOString(),
    };
    try {
      await persistKnowledge(next);
      setEditingSection(null);
      toast.success("Section updated");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Update failed");
    }
  }

  async function regenerateSection(section: PropertyKnowledgeSection) {
    setSaving(true);
    setPipelineStep("extracting");
    try {
      const res = await fetch("/api/knowledge/ingest", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          property_id: propertyId,
          experience_id: experienceId,
          message: `Regenerate and improve the "${CARD_TITLES[section.key] ?? section.label}" section only. Current content:\n${sectionDisplayText(section)}`,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Regenerate failed");
      setPipelineStep("ready");
      if (data.structured_knowledge) {
        setKnowledge(data.structured_knowledge);
        onKnowledgeChange?.(data.structured_knowledge);
      }
      await loadKnowledge();
      toast.success("Section regenerated");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Regenerate failed");
    } finally {
      setSaving(false);
      window.setTimeout(() => setPipelineStep(null), 2000);
    }
  }

  const populatedSections = knowledge?.sections.filter(sectionHasContent) ?? [];
  const fieldCount = knowledge ? countPopulatedKnowledgeFields(knowledge) : 0;

  return (
    <div className="wt-wpk">
      <header className="wt-wpk-header">
        <div>
          <h2 className="wt-wpk-title">Property Knowledge</h2>
          <p className="wt-wpk-subtitle">
            Add everything buyers might ask — your voice agent answers only from what you save here.
          </p>
        </div>
        <div className="wt-wpk-readiness">
          <Sparkles className="h-4 w-4 text-primary shrink-0" />
          <div className="min-w-0 flex-1">
            <p className="text-[11px] text-muted-foreground">Completeness</p>
            <div className="flex items-center gap-2">
              <span className="text-sm font-semibold tabular-nums">{readiness}%</span>
              <Progress value={readiness} className="h-1.5 flex-1" />
            </div>
          </div>
        </div>
      </header>

      <StatusBar step={pipelineStep} />

      {loading ? (
        <div className="wt-wpk-loading">
          <Loader2 className="h-5 w-5 animate-spin" />
          <span>Loading knowledge…</span>
        </div>
      ) : knowledge && structuredKnowledgeHasContent(knowledge) ? (
        <section className="wt-wpk-cards">
          <div className="wt-wpk-cards-head">
            <h3 className="text-sm font-medium">Stored knowledge</h3>
            <span className="text-xs text-muted-foreground">{fieldCount} fields · Voice agent ready</span>
          </div>
          <div className="wt-wpk-cards-grid">
            <AnimatePresence mode="popLayout">
              {populatedSections.map((section) => {
                const body = sectionDisplayText(section);
                if (!body) return null;
                return (
                  <KnowledgeCard
                    key={section.key}
                    title={CARD_TITLES[section.key] ?? section.label}
                    content={body}
                    busy={saving}
                    onEdit={() => {
                      setEditingSection(section);
                      setEditDraft(
                        section.kind === "list"
                          ? (section.items ?? []).map((i) => i.text).join("\n")
                          : body,
                      );
                    }}
                    onDelete={() => void deleteSection(section)}
                    onRegenerate={() => void regenerateSection(section)}
                  />
                );
              })}
            </AnimatePresence>
          </div>
        </section>
      ) : null}

      {editingSection && (
        <div className="wt-wpk-edit-overlay">
          <div className="wt-wpk-edit-panel">
            <h4 className="font-medium">Edit {CARD_TITLES[editingSection.key] ?? editingSection.label}</h4>
            <textarea
              className="wt-wpk-textarea mt-3"
              rows={6}
              value={editDraft}
              onChange={(e) => setEditDraft(e.target.value)}
            />
            <div className="mt-3 flex justify-end gap-2">
              <Button variant="outline" onClick={() => setEditingSection(null)}>Cancel</Button>
              <Button onClick={() => void saveEdit()}>Save section</Button>
            </div>
          </div>
        </div>
      )}

      <section
        ref={dropRef}
        className="wt-wpk-composer"
        data-drag={dragOver ? "true" : "false"}
        onDragOver={(e) => {
          e.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={onDrop}
      >
        <textarea
          className="wt-wpk-textarea"
          placeholder="Paste your brochure, property description, amenities, pricing, nearby locations, specifications… (200–500 words works great)"
          value={text}
          onChange={(e) => setText(e.target.value)}
          rows={6}
          disabled={saving}
        />

        {(brochure || pamphlet) && (
          <div className="wt-wpk-files">
            {brochure && (
              <span className="wt-wpk-file-chip">
                <FileText className="h-3.5 w-3.5" /> Brochure: {brochure.name}
                <button type="button" onClick={() => setBrochure(null)} aria-label="Remove brochure">×</button>
              </span>
            )}
            {pamphlet && (
              <span className="wt-wpk-file-chip">
                <FileText className="h-3.5 w-3.5" /> Pamphlet: {pamphlet.name}
                <button type="button" onClick={() => setPamphlet(null)} aria-label="Remove pamphlet">×</button>
              </span>
            )}
          </div>
        )}

        {uploadProgress != null && (
          <div className="wt-wpk-upload-progress">
            <Progress value={uploadProgress} className="h-1" />
            <span className="text-xs text-muted-foreground">Uploading… {uploadProgress}%</span>
          </div>
        )}

        <p className="wt-wpk-drop-hint">
          <Upload className="inline h-3.5 w-3.5 mr-1" />
          Drag & drop a PDF here, or use the upload buttons below
        </p>

        <div className="wt-wpk-composer-actions">
          <label className="wt-wpk-upload-btn">
            <Input
              type="file"
              accept=".pdf,application/pdf"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) void assignFile(f, "brochure");
                e.target.value = "";
              }}
            />
            Upload Brochure
          </label>
          <label className="wt-wpk-upload-btn">
            <Input
              type="file"
              accept=".pdf,.txt,.md,application/pdf,text/*"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) void assignFile(f, "pamphlet");
                e.target.value = "";
              }}
            />
            Upload Pamphlet
          </label>
          <Button className="ml-auto" onClick={() => void handleSave()} disabled={saving}>
            {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            Save
          </Button>
        </div>
      </section>
    </div>
  );
}
