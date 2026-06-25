import { SpatialSalesAppShell } from "@/components/shell/spatial-sales-app-shell";

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return <SpatialSalesAppShell>{children}</SpatialSalesAppShell>;
}
