"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { KnowledgeCategory } from "@/types/domain";
import { toast } from "sonner";

const CATEGORIES: { category: KnowledgeCategory; label: string }[] = [
  { category: "project_details", label: "Project Details" },
  { category: "unit_details", label: "Unit Details" },
  { category: "pricing", label: "Pricing" },
  { category: "availability", label: "Availability" },
  { category: "amenities", label: "Amenities" },
  { category: "possession", label: "Possession" },
  { category: "legal", label: "Legal" },
  { category: "rera", label: "RERA" },
  { category: "faq", label: "FAQs" },
];

export function KnowledgeBaseManager() {
  const [properties, setProperties] = useState<{ id: string; name: string }[]>([]);
  const [propertyId, setPropertyId] = useState("");
  const [readiness, setReadiness] = useState(0);
  const [categories, setCategories] = useState<{ category: string; status: string }[]>([]);
  const [form, setForm] = useState({ category: "pricing", title: "", content: "" });

  useEffect(() => {
    fetch("/api/properties").then((r) => r.json()).then((d) => {
      setProperties(d);
      if (d[0]) setPropertyId(d[0].id);
    });
  }, []);

  useEffect(() => {
    if (!propertyId) return;
    fetch(`/api/knowledge?propertyId=${propertyId}`).then((r) => r.json()).then((d) => {
      setReadiness(d.readiness?.overall ?? 0);
      setCategories(d.readiness?.categories ?? []);
    });
  }, [propertyId]);

  async function addEntry() {
    const res = await fetch("/api/knowledge", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...form, property_id: propertyId, approved: true }),
    });
    const data = await res.json();
    if (!res.ok) return toast.error(data.error);
    toast.success("Knowledge entry added + embedded");
    fetch(`/api/knowledge?propertyId=${propertyId}`).then((r) => r.json()).then((d) => {
      setReadiness(d.readiness?.overall ?? 0);
      setCategories(d.readiness?.categories ?? []);
    });
    setForm({ category: "pricing", title: "", content: "" });
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-xl font-semibold sm:text-2xl">AI Knowledge Base</h1>
          <p className="text-sm text-muted-foreground sm:text-base">Zero-hallucination — complete critical categories before publishing AI</p>
        </div>
        <select className="w-full rounded-md border px-3 py-2.5 text-sm sm:w-auto" value={propertyId} onChange={(e) => setPropertyId(e.target.value)}>
          {properties.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
        </select>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>AI Readiness</CardTitle>
          <CardDescription>Overall: {readiness}%</CardDescription>
        </CardHeader>
        <CardContent>
          <Progress value={readiness} className="mb-4" />
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {(categories.length ? categories : CATEGORIES.map((c) => ({ category: c.category, status: "missing" }))).map((cat) => (
              <div key={cat.category} className="flex items-center justify-between rounded-md border p-3">
                <span className="text-sm">{CATEGORIES.find((c) => c.category === cat.category)?.label ?? cat.category}</span>
                <Badge variant={cat.status === "complete" ? "success" : "warning"}>{cat.status}</Badge>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Add Knowledge Entry</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <select className="w-full rounded-md border px-3 py-2 text-sm" value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })}>
            {CATEGORIES.map((c) => <option key={c.category} value={c.category}>{c.label}</option>)}
          </select>
          <Input placeholder="Title" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
          <textarea className="w-full rounded-md border p-3 text-sm" rows={4} placeholder="Approved content…" value={form.content} onChange={(e) => setForm({ ...form, content: e.target.value })} />
          <Button onClick={addEntry} disabled={!form.title || !form.content || !propertyId}>Save & Embed</Button>
        </CardContent>
      </Card>
    </div>
  );
}
