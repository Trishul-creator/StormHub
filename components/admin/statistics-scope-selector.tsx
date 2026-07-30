"use client";

import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";

interface StatisticsScopeOption {
  id: string;
  name: string;
  slug: string;
}

export function StatisticsScopeSelector({
  schools,
  activeSlug,
  baseQuery,
  allLabel = "All schools",
  label = "View scope",
  queryKey = "school",
  clearQueryKeys = [],
  onNavigate,
}: {
  schools: StatisticsScopeOption[];
  activeSlug: string | null;
  baseQuery?: Record<string, string>;
  allLabel?: string;
  label?: string;
  queryKey?: "school" | "district";
  clearQueryKeys?: Array<"school" | "district">;
  onNavigate?: (destination: string) => void;
}) {
  const [selectedSlug, setSelectedSlug] = useState(activeSlug ?? "");
  const [pending, setPending] = useState(false);

  useEffect(() => {
    setSelectedSlug(activeSlug ?? "");
    setPending(false);
  }, [activeSlug]);

  function changeScope(nextSlug: string) {
    setSelectedSlug(nextSlug);
    const query = new URLSearchParams(baseQuery);
    for (const key of clearQueryKeys) query.delete(key);
    if (nextSlug) query.set(queryKey, nextSlug);
    else query.delete(queryKey);
    const destination = query.size > 0
      ? `/admin/statistics?${query.toString()}`
      : "/admin/statistics";
    setPending(true);
    if (onNavigate) {
      onNavigate(destination);
      return;
    }

    // A full navigation is intentional here. Next.js client transitions can
    // leave streamed, data-heavy statistics routes suspended after the RSC
    // response is aborted, which makes the selector appear permanently busy.
    // Reloading the scoped URL keeps the query string, session, and server-side
    // authorization checks deterministic.
    window.location.assign(destination);
  }

  return (
    <label className="relative block w-full text-xs font-semibold uppercase tracking-wide text-blue-950/70 dark:text-blue-200/75 sm:w-auto">
      {label}
      <select
        aria-label={label}
        value={selectedSlug}
        disabled={pending}
        onChange={(event) => changeScope(event.target.value)}
        className="mt-1 block h-10 w-full min-w-56 rounded-lg border border-blue-200 bg-card px-3 pr-10 text-sm font-medium normal-case tracking-normal text-storm-navy shadow-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-200 disabled:cursor-wait disabled:opacity-75 dark:border-blue-900"
      >
        <option value="">{allLabel}</option>
        {schools.map((school) => (
          <option key={school.id} value={school.slug}>{school.name}</option>
        ))}
      </select>
      {pending && (
        <Loader2
          aria-label="Updating statistics"
          className="absolute bottom-3 right-3 h-4 w-4 animate-spin text-storm-electric"
        />
      )}
    </label>
  );
}
