"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { RoleGuard } from "@/components/auth/role-guard";
import { BrochureUploadPanel } from "@/components/brochure/brochure-upload-panel";

export default function NewBrochurePage() {
  const router = useRouter();
  const [properties, setProperties] = useState<{ id: string; name: string }[]>([]);

  useEffect(() => {
    void fetch("/api/properties")
      .then((r) => r.json())
      .then((data) => setProperties((data ?? []).map((p: { id: string; name: string }) => ({ id: p.id, name: p.name }))))
      .catch(() => setProperties([]));
  }, []);

  return (
    <RoleGuard minRole="sales_agent">
      <div className="mx-auto max-w-4xl space-y-6 p-6">
        <div>
          <h1 className="text-2xl font-semibold">Upload Smart Brochure</h1>
          <p className="text-sm text-muted-foreground">PDF upload with lead gate, tracking, and buyer intelligence.</p>
        </div>
        <BrochureUploadPanel
          properties={properties}
          onUploaded={(b) => router.push(`/dashboard/brochures/${b.id}`)}
        />
      </div>
    </RoleGuard>
  );
}
