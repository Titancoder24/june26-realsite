import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function DashboardImageWalkthroughRedirectPage() {
  return (
    <div className="mx-auto max-w-lg space-y-4 p-6 text-center">
      <h1 className="text-lg font-semibold">Image Walkthrough — Super Admin only</h1>
      <p className="text-sm text-muted-foreground">
        Image Walkthrough creation and editing has moved to the Super Admin panel.
        Published tours remain available to your organization from Virtual Tours.
      </p>
      <Button variant="outline" asChild>
        <Link href="/dashboard/experiences">Back to Virtual Tours</Link>
      </Button>
    </div>
  );
}
