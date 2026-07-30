"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
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
  const [pending, setPending] = useState(false);
  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

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
    setPending(true);
    const destination = destinationFor(next);
    if (onNavigate) {
      onNavigate(destination);
      return;
    }
    window.location.assign(destination);
  }

  function updateSearch(nextSearch: string) {
    setSearch(nextSearch);
    if (searchTimer.current) clearTimeout(searchTimer.current);
    searchTimer.current = setTimeout(() => {
      navigate({ search: nextSearch, role, school });
    }, 450);
  }

  const hasFilters = Boolean(initialSearch || initialRole || (showSchool && initialSchool));

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
            disabled={pending}
            onChange={(event) => updateSearch(event.target.value)}
            onKeyDown={(event) => {
              if (event.key !== "Enter") return;
              event.preventDefault();
              navigate({ search, role, school });
            }}
            className="h-10 w-full rounded-lg border bg-background pl-9 pr-3 text-foreground disabled:cursor-wait disabled:opacity-70"
          />
        </span>
      </label>

      <label className="text-sm font-medium text-storm-navy">
        Role
        <select
          name="role"
          value={role}
          disabled={pending}
          onChange={(event) => {
            const nextRole = event.target.value as UserRole | "";
            setRole(nextRole);
            navigate({ search, role: nextRole, school });
          }}
          className="mt-1 block h-10 w-full rounded-lg border bg-background px-3 text-foreground disabled:cursor-wait disabled:opacity-70"
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
            disabled={pending}
            onChange={(event) => {
              const nextSchool = event.target.value;
              setSchool(nextSchool);
              navigate({ search, role, school: nextSchool });
            }}
            className="mt-1 block h-10 w-full rounded-lg border bg-background px-3 text-foreground disabled:cursor-wait disabled:opacity-70"
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
          <Button variant="ghost" size="sm" asChild>
            <Link href="/admin/users">
              <X className="h-4 w-4" aria-hidden="true" />
              Clear
            </Link>
          </Button>
        )}
      </div>
    </div>
  );
}
