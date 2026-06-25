"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { toast } from "sonner";

const STEPS = ["Basics", "Compliance", "Branding", "Sales Defaults"];

export function ProjectCreateWizard() {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [form, setForm] = useState({
    name: "", city: "", locality: "", address: "", project_type: "residential",
    rera_number: "", possession_timeline: "",
    branding: { primary_color: "#4f46e5", logo_url: "" },
    settings: { default_language: "en", currency: "INR" },
  });

  async function submit() {
    const res = await fetch("/api/projects", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: form.name,
        city: form.city,
        locality: form.locality,
        address: form.address,
        project_type: form.project_type,
        rera_number: form.rera_number,
        possession_timeline: form.possession_timeline,
        branding: form.branding,
        settings: form.settings,
      }),
    });
    const data = await res.json();
    if (!res.ok) return toast.error(data.error);
    toast.success("Project created");
    router.push("/dashboard/projects");
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div className="flex gap-2">{STEPS.map((s, i) => <span key={s} className={`text-sm ${i <= step ? "font-medium text-primary" : "text-muted-foreground"}`}>{s}</span>)}</div>
      <Progress value={((step + 1) / STEPS.length) * 100} />
      <Card>
        <CardHeader><CardTitle>{STEPS[step]}</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          {step === 0 && (
            <>
              <Input placeholder="Project name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
              <Input placeholder="City" value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })} />
              <Input placeholder="Locality" value={form.locality} onChange={(e) => setForm({ ...form, locality: e.target.value })} />
              <Input placeholder="Full address" value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} />
            </>
          )}
          {step === 1 && (
            <>
              <Input placeholder="RERA number" value={form.rera_number} onChange={(e) => setForm({ ...form, rera_number: e.target.value })} />
              <Input placeholder="Possession timeline" value={form.possession_timeline} onChange={(e) => setForm({ ...form, possession_timeline: e.target.value })} />
            </>
          )}
          {step === 2 && (
            <>
              <Input placeholder="Primary color (hex)" value={form.branding.primary_color} onChange={(e) => setForm({ ...form, branding: { ...form.branding, primary_color: e.target.value } })} />
              <Input placeholder="Logo URL" value={form.branding.logo_url} onChange={(e) => setForm({ ...form, branding: { ...form.branding, logo_url: e.target.value } })} />
            </>
          )}
          {step === 3 && (
            <>
              <Input placeholder="Default language" value={form.settings.default_language} onChange={(e) => setForm({ ...form, settings: { ...form.settings, default_language: e.target.value } })} />
              <Input placeholder="Currency" value={form.settings.currency} onChange={(e) => setForm({ ...form, settings: { ...form.settings, currency: e.target.value } })} />
            </>
          )}
          <div className="flex gap-2">
            {step > 0 && <Button variant="outline" onClick={() => setStep(step - 1)}>Back</Button>}
            {step < STEPS.length - 1 ? (
              <Button onClick={() => setStep(step + 1)} disabled={step === 0 && !form.name}>Next</Button>
            ) : (
              <Button onClick={submit}>Create Project</Button>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
