"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Search, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { UserRole } from "@/types/database";

interface InventorySchoolOption {
  id: string;
  name: string;
  slug: string;
}

export function UserInventoryFilters({
  initialSearch,
  initialRole,
  initialSchool,
  roles,
  schools,
  schoolLabel,
  showSchool,
  onNavigate,
}: {
  initialSearch: string;
  initialRole: UserRole | null;
  initialSchool: string | null;
  roles: UserRole[];
  schools: InventorySchoolOption[];
  schoolLabel: string;
  showSchool: boolean;
  onNavigate?: (destination: string) => void;
}) {
  const [search, setSearch] = useState(initialSearch);
  const [role, setRole] = useState<UserRole | "">(initialRole ?? "");
  const [school, setSchool] = useState(initialSchool ?? "");
  const [pending, startTransition] = useTransition();
  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const router = useRouter();

  useEffect(() => () => {
    if (searchTimer.current) clearTimeout(searchTimer.current);
  }, []);

  function destinationFor(next: {
    search: string;
    role: UserRole | "";
    school: string;
  }) {
    const query = new URLSearchParams();
    const normalizedSearch = next.search.trim().slice(0, 100);
    if (normalizedSearch) query.set("q", normalizedSearch);
    if (next.role) query.set("role", next.role);
    if (showSchool && next.school) query.set("school", next.school);
    return query.size > 0 ? `/admin/users?${query.toString()}` : "/admin/users";
  }

  function navigate(next: {
    search: string;
    role: UserRole | "";
    school: string;
  }) {
    if (searchTimer.current) clearTimeout(searchTimer.current);
    const destination = destinationFor(next);
    if (onNavigate) {
      onNavigate(destination);
      return;
    }
    startTransition(() => router.replace(destination, { scroll: false }));
  }

  function updateSearch(nextSearch: string) {
    setSearch(nextSearch);
    if (searchTimer.current) clearTimeout(searchTimer.current);
    searchTimer.current = setTimeout(() => {
      navigate({ search: nextSearch, role, school });
    }, 450);
  }

  const hasFilters = Boolean(search || role || (showSchool && school));

  function clearFilters() {
    setSearch("");
    setRole("");
    setSchool("");
    navigate({ search: "", role: "", school: "" });
  }

  return (
    <div
      className={`mb-6 grid gap-3 rounded-xl border bg-card p-4 ${
        showSchool
          ? "md:grid-cols-[minmax(0,1fr)_minmax(10rem,14rem)_minmax(14rem,20rem)_auto]"
          : "md:grid-cols-[minmax(0,1fr)_minmax(10rem,14rem)_auto]"
      } md:items-end`}
      role="search"
      aria-label="User inventory filters"
    >
      <label className="text-sm font-medium text-storm-navy">
        Search people
        <span className="relative mt-1 block">
          <Search
            className="pointer-events-none absolute left-3 top-3 h-4 w-4 text-muted-foreground"
            aria-hidden="true"
          />
          <input
            name="q"
            type="search"
            value={search}
            maxLength={100}
            placeholder="Name or email"
            onChange={(event) => updateSearch(event.target.value)}
            onKeyDown={(event) => {
              if (event.key !== "Enter") return;
              event.preventDefault();
              navigate({ search, role, school });
            }}
            className="h-10 w-full rounded-lg border bg-background pl-9 pr-3 text-foreground"
          />
        </span>
      </label>

      <label className="text-sm font-medium text-storm-navy">
        Role
        <select
          name="role"
          value={role}
          onChange={(event) => {
            const nextRole = event.target.value as UserRole | "";
            setRole(nextRole);
            navigate({ search, role: nextRole, school });
          }}
          className="mt-1 block h-10 w-full rounded-lg border bg-background px-3 text-foreground"
        >
          <option value="">All roles</option>
          {roles.map((option) => (
            <option key={option} value={option}>{option.replace("_", " ")}</option>
          ))}
        </select>
      </label>

      {showSchool && (
        <label className="text-sm font-medium text-storm-navy">
          School scope
          <select
            name="school"
            value={school}
            onChange={(event) => {
              const nextSchool = event.target.value;
              setSchool(nextSchool);
              navigate({ search, role, school: nextSchool });
            }}
            className="mt-1 block h-10 w-full rounded-lg border bg-background px-3 text-foreground"
          >
            <option value="">{schoolLabel}</option>
            {schools.map((option) => (
              <option key={option.id} value={option.slug}>{option.name}</option>
            ))}
          </select>
        </label>
      )}

      <div className="flex h-10 items-center justify-end gap-2">
        {pending && (
          <Loader2
            className="h-4 w-4 animate-spin text-storm-electric"
            aria-label="Updating users"
          />
        )}
        {hasFilters && (
          <Button type="button" variant="ghost" size="sm" onClick={clearFilters}>
            <X className="h-4 w-4" aria-hidden="true" />
            Clear
          </Button>
        )}
      </div>
    </div>
  );
}
