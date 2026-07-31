"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Building2, Loader2 } from "lucide-react";
import type { School } from "@/types/database";

export function SupportSchoolSelector({
  schools,
  activeSlug,
}: {
  schools: School[];
  activeSlug?: string | null;
}) {
  const router = useRouter();
  const [selectedSlug, setSelectedSlug] = useState(activeSlug ?? "");
  const [pending, startTransition] = useTransition();

  function selectSchool(nextSlug: string) {
    setSelectedSlug(nextSlug);
    const destination = nextSlug
      ? `/admin/feedback?school=${encodeURIComponent(nextSlug)}`
      : "/admin/feedback";
    startTransition(() => router.replace(destination, { scroll: false }));
  }

  return (
    <label className="mb-6 flex flex-col gap-2 rounded-xl border bg-card p-4 text-sm font-medium text-storm-navy sm:flex-row sm:items-center">
      <span className="flex items-center gap-2 sm:min-w-44">
        <Building2 className="h-4 w-4 text-storm-electric" aria-hidden="true" />
        School inbox
      </span>
      <span className="relative flex-1">
        <select
          aria-label="School inbox"
          value={selectedSlug}
          onChange={(event) => selectSchool(event.target.value)}
          className="h-10 w-full rounded-lg border bg-background px-3 pr-10 text-foreground"
        >
          <option value="">Choose a school</option>
          {schools.map((school) => (
            <option key={school.id} value={school.slug}>{school.name}</option>
          ))}
        </select>
        {pending && (
          <Loader2
            className="pointer-events-none absolute right-3 top-3 h-4 w-4 animate-spin text-storm-electric"
            aria-label="Opening school inbox"
          />
        )}
      </span>
      <span className="text-xs font-normal text-muted-foreground">
        Opens automatically
      </span>
    </label>
  );
}
