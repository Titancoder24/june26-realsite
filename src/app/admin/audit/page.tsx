import { AuditLogViewer } from "@/components/admin/audit-log-viewer";

export default function AuditLogPage() {
  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <h1 className="section-title">Audit Logs</h1>
      <AuditLogViewer />
    </div>
  );
}
