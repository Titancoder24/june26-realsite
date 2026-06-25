import { AdminShellGate } from "@/components/admin/admin-shell-gate";

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="super-admin-layout min-h-svh bg-background">
      <AdminShellGate>{children}</AdminShellGate>
    </div>
  );
}
