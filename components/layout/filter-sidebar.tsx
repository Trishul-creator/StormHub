"use client";

import { useState } from "react";
import { useSearchParams } from "next/navigation";
import { Filter, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/cn";

interface FilterOption {
  label: string;
  value: string;
}

interface FilterSidebarProps {
  title?: string;
  options: FilterOption[];
  activeValue?: string;
  paramName?: string;
  className?: string;
}

export function FilterSidebar({ title = "Filter", options, activeValue, paramName = "filter", className }: FilterSidebarProps) {
  const searchParams = useSearchParams();
  function hrefFor(value?: string) {
    const params = new URLSearchParams(searchParams.toString());
    if (value) params.set(paramName, value);
    else params.delete(paramName);
    const query = params.toString();
    return query ? `?${query}` : "?";
  }

  return (
    <div className={cn("space-y-2", className)}>
      <h3 className="font-semibold text-storm-navy text-sm">{title}</h3>
      <div className="flex flex-col gap-1">
        <a
          href={hrefFor()}
          className={cn(
            "rounded-lg px-3 py-2 text-sm transition-colors",
            !activeValue ? "bg-storm-electric/10 text-storm-electric font-medium" : "hover:bg-storm-light/50 text-muted-foreground"
          )}
        >
          All
        </a>
        {options.map((opt) => (
          <a
            key={opt.value}
            href={hrefFor(opt.value)}
            className={cn(
              "rounded-lg px-3 py-2 text-sm transition-colors",
              activeValue === opt.value ? "bg-storm-electric/10 text-storm-electric font-medium" : "hover:bg-storm-light/50 text-muted-foreground"
            )}
          >
            {opt.label}
          </a>
        ))}
      </div>
    </div>
  );
}

export function MobileFilterDrawer({ title, options, activeValue, paramName = "filter" }: FilterSidebarProps) {
  const [open, setOpen] = useState(false);

  return (
    <div className="lg:hidden">
      <Button variant="outline" size="sm" onClick={() => setOpen(true)} className="mb-4">
        <Filter className="h-4 w-4 mr-1" /> Filters
        {activeValue && <span className="ml-1 rounded-full bg-storm-electric px-1.5 text-xs text-white">1</span>}
      </Button>
      {open && (
        <div className="fixed inset-0 z-50 bg-black/50" onClick={() => setOpen(false)}>
          <div className="absolute bottom-0 left-0 right-0 max-h-[70vh] overflow-y-auto rounded-t-2xl bg-white p-6" onClick={(e) => e.stopPropagation()}>
            <div className="mb-4 flex items-center justify-between">
              <h3 className="font-semibold">{title}</h3>
              <button onClick={() => setOpen(false)}><X className="h-5 w-5" /></button>
            </div>
            <FilterSidebar options={options} activeValue={activeValue} paramName={paramName} />
          </div>
        </div>
      )}
    </div>
  );
}
