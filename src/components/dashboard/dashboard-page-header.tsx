import { cn } from "@/lib/utils";

export function DashboardPageHeader({
  title,
  description,
  actions,
  className,
}: {
  title: string;
  description?: string;
  actions?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between", className)}>
      <div className="min-w-0 space-y-1.5">
        <h1 className="section-title">{title}</h1>
        {description && (
          <p className="type-body max-w-2xl text-muted-foreground">
            {description}
          </p>
        )}
      </div>
      {actions && <div className="flex shrink-0 flex-col gap-2 sm:flex-row">{actions}</div>}
    </div>
  );
}
