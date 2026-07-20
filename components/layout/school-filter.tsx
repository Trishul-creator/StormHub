"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { School as SchoolIcon } from "lucide-react";

interface SchoolFilterOption {
  slug: string;
  name: string;
  short_name?: string | null;
}

export function SchoolFilter({
  schools,
  activeSlug,
}: {
  schools: SchoolFilterOption[];
  activeSlug?: string | null;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();

  if (schools.length <= 1) return null;

  function selectSchool(slug: string) {
    const params = new URLSearchParams(searchParams.toString());
    if (slug) params.set("school", slug);
    else params.delete("school");
    router.push(`${pathname}?${params.toString()}`);
  }

  return (
    <label className="flex min-w-56 items-center gap-2 text-sm font-medium text-storm-navy">
      <SchoolIcon className="h-4 w-4 text-storm-electric" aria-hidden="true" />
      <span className="sr-only">School</span>
      <select
        aria-label="School"
        value={activeSlug ?? ""}
        onChange={(event) => selectSchool(event.target.value)}
        className="h-10 w-full rounded-md border border-input bg-white px-3 text-sm"
      >
        {schools.map((school) => (
          <option key={school.slug} value={school.slug}>
            {school.short_name || school.name}
          </option>
        ))}
      </select>
    </label>
  );
}
