"use client";

import { useState } from "react";
import { Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { PIN_CATEGORIES, pinsForCategory } from "@/lib/pins/pin-library";
import type { PinCategory, PinTypeId } from "@/types/annotations";

export function PinPicker({
  selectedType,
  onSelect,
  compact = false,
}: {
  selectedType: PinTypeId;
  onSelect: (type: PinTypeId) => void;
  compact?: boolean;
}) {
  const [category, setCategory] = useState<PinCategory>("architecture");
  const [query, setQuery] = useState("");

  const pins = pinsForCategory(category).filter((p) => {
    if (!query.trim()) return true;
    const q = query.toLowerCase();
    return p.label.toLowerCase().includes(q) || p.id.includes(q);
  });

  return (
    <div className="flex flex-col gap-2">
      <div className="relative">
        <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="Search 100+ pin types…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="h-9 pl-8 text-sm"
        />
      </div>

      <div className="flex gap-1 overflow-x-auto pb-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {PIN_CATEGORIES.map((c) => (
          <button
            key={c.id}
            type="button"
            onClick={() => setCategory(c.id)}
            className={cn(
              "shrink-0 rounded-full px-3 py-1.5 text-xs font-medium transition-colors",
              category === c.id ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground",
            )}
          >
            {c.label}
          </button>
        ))}
      </div>

      <div className={cn("grid gap-1.5", compact ? "grid-cols-4" : "grid-cols-4 sm:grid-cols-5")}>
        {pins.map((pin) => (
          <button
            key={pin.id}
            type="button"
            onClick={() => onSelect(pin.id)}
            className={cn(
              "flex flex-col items-center gap-0.5 rounded-lg border p-2 text-center transition-all active:scale-95",
              selectedType === pin.id ? "border-primary bg-primary/10 ring-2 ring-primary/30" : "border-border hover:bg-muted/50",
            )}
            style={{ ["--pin-color" as string]: pin.color }}
          >
            <span className="text-lg leading-none">{pin.icon}</span>
            <span className="line-clamp-2 text-[10px] font-medium leading-tight">{pin.label}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
