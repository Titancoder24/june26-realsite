"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { RoleGuard } from "@/components/auth/role-guard";
import { BrochureBuyerProfile } from "@/components/brochure/brochure-buyer-profile";

export default function BrochureSessionPage({
  params,
}: {
  params: Promise<{ brochureId: string; sessionId: string }>;
}) {
  const [ids, setIds] = useState<{ brochureId: string; sessionId: string } | null>(null);
  const [detail, setDetail] = useState<Parameters<typeof BrochureBuyerProfile>[0]["detail"] | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    void params.then((p) => {
      setIds(p);
      void fetch(`/api/brochures/sessions/${p.sessionId}/detail`)
        .then((r) => r.json())
        .then((data) => {
          setDetail(data);
          setLoading(false);
        })
        .catch(() => setLoading(false));
    });
  }, [params]);

  return (
    <RoleGuard minRole="sales_agent">
      <div className="bi-dashboard bi-module-shell p-6">
        {ids && (
          <Link
            href={`/dashboard/brochures/${ids.brochureId}/reports`}
            className="text-sm text-muted-foreground hover:underline"
          >
            ← Back to brochure reports
          </Link>
        )}
        {loading && <p className="text-sm text-muted-foreground">Loading buyer journey report…</p>}
        {ids && detail && (
          <BrochureBuyerProfile brochureId={ids.brochureId} sessionId={ids.sessionId} detail={detail} />
        )}
      </div>
    </RoleGuard>
  );
}
