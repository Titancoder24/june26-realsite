import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function NotFound() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 p-6 text-center">
      <p className="text-sm font-medium text-muted-foreground">404</p>
      <h1 className="section-title">Page not found</h1>
      <p className="max-w-md text-muted-foreground">
        This route does not exist. Check the URL or return to your dashboard.
      </p>
      <div className="flex gap-2">
        <Button asChild><Link href="/dashboard">Dashboard</Link></Button>
        <Button variant="outline" asChild><Link href="/">Home</Link></Button>
      </div>
    </div>
  );
}
