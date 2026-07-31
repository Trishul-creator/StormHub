"use client";

import { useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
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
  exclusiveParamNames?: string[];
  className?: string;
  onSelection?: () => void;
}

export function FilterSidebar({
  title = "Filter",
  options,
  activeValue,
  paramName = "filter",
  exclusiveParamNames = [],
  className,
  onSelection,
}: FilterSidebarProps) {
  const searchParams = useSearchParams();
  function hrefFor(value?: string) {
    const params = new URLSearchParams(searchParams.toString());
    if (value) {
      params.set(paramName, value);
      exclusiveParamNames.forEach((name) => params.delete(name));
    } else {
      params.delete(paramName);
      exclusiveParamNames.forEach((name) => params.delete(name));
    }
    const query = params.toString();
    return query ? `?${query}` : "?";
  }

  return (
    <div className={cn("space-y-2", className)}>
      <h2 className="font-semibold text-storm-navy text-sm">{title}</h2>
      <div className="flex flex-col gap-1">
        <Link
          href={hrefFor()}
          scroll={false}
          onClick={onSelection}
          className={cn(
            "rounded-lg px-3 py-2 text-sm transition-colors",
            !activeValue ? "bg-storm-electric/10 text-storm-electric font-medium" : "hover:bg-storm-light/50 text-muted-foreground"
          )}
        >
          All
        </Link>
        {options.map((opt) => (
          <Link
            key={opt.value}
            href={hrefFor(opt.value)}
            scroll={false}
            onClick={onSelection}
            className={cn(
              "rounded-lg px-3 py-2 text-sm transition-colors",
              activeValue === opt.value ? "bg-storm-electric/10 text-storm-electric font-medium" : "hover:bg-storm-light/50 text-muted-foreground"
            )}
          >
            {opt.label}
          </Link>
        ))}
      </div>
    </div>
  );
}

export function MobileFilterDrawer({
  title,
  options,
  activeValue,
  paramName = "filter",
  exclusiveParamNames = [],
}: FilterSidebarProps) {
  const [open, setOpen] = useState(false);

  return (
    <div className="lg:hidden">
      <Button variant="outline" size="sm" onClick={() => setOpen(true)} className="mb-4">
        <Filter className="h-4 w-4 mr-1" /> Filters
        {activeValue && <span className="ml-1 rounded-full bg-storm-electric px-1.5 text-xs text-white">1</span>}
      </Button>
      {open && (
        <div className="fixed inset-0 z-50 bg-black/50" onClick={() => setOpen(false)}>
          <div className="absolute bottom-0 left-0 right-0 max-h-[70vh] overflow-y-auto rounded-t-2xl bg-background p-6" onClick={(e) => e.stopPropagation()}>
            <div className="mb-4 flex items-center justify-between">
              <h2 className="font-semibold">{title}</h2>
              <button aria-label="Close filters" onClick={() => setOpen(false)}><X className="h-5 w-5" /></button>
            </div>
            <FilterSidebar
              options={options}
              activeValue={activeValue}
              paramName={paramName}
              exclusiveParamNames={exclusiveParamNames}
              onSelection={() => setOpen(false)}
            />
          </div>
        </div>
      )}
    </div>
  );
}
