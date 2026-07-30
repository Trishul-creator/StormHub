"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Eye, FilePenLine, Rocket, Search, Settings, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { CategoryBadge } from "@/components/ui/badge";

export interface DraftClubCatalogItem {
  id: string;
  name: string;
  slug: string;
  category?: string | null;
  short_description?: string | null;
  tags?: string[] | null;
}

export function DraftClubCatalog({
  clubs,
  mode,
  readOnly = false,
}: {
  clubs: DraftClubCatalogItem[];
  mode: "platform-admin" | "admin" | "teacher";
  readOnly?: boolean;
}) {
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("all");
  const categories = useMemo(
    () => Array.from(new Set(clubs.map((club) => club.category).filter((value): value is string => Boolean(value)))).sort(),
    [clubs]
  );
  const normalizedQuery = query.trim().toLowerCase();
  const filteredClubs = useMemo(
    () => clubs.filter((club) => {
      if (category !== "all" && club.category !== category) return false;
      if (!normalizedQuery) return true;
      return [
        club.name,
        club.category ?? "",
        club.short_description ?? "",
        ...(club.tags ?? []),
      ].some((value) => value.toLowerCase().includes(normalizedQuery));
    }),
    [category, clubs, normalizedQuery]
  );
  const hasFilters = Boolean(normalizedQuery) || category !== "all";

  if (clubs.length === 0) {
    return (
      <div className="rounded-xl border border-dashed bg-card px-6 py-12 text-center">
        <p className="font-semibold text-foreground">No draft clubs</p>
        <p className="mt-1 text-sm text-muted-foreground">
          Draft clubs will appear here while administrators confirm their details before publishing.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div className="rounded-xl border bg-card p-4 shadow-sm">
        <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_220px_auto]">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              aria-label="Search draft clubs"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search by club, category, or interest"
              className="pl-9"
            />
          </div>
          <select
            aria-label="Filter draft clubs by category"
            value={category}
            onChange={(event) => setCategory(event.target.value)}
            className="h-10 rounded-lg border border-input bg-card px-3 text-sm text-foreground shadow-sm"
          >
            <option value="all">All categories</option>
            {categories.map((option) => (
              <option key={option} value={option}>{option}</option>
            ))}
          </select>
          {hasFilters ? (
            <Button
              type="button"
              variant="ghost"
              onClick={() => {
                setQuery("");
                setCategory("all");
              }}
            >
              <X className="h-4 w-4" />
              Clear
            </Button>
          ) : (
            <div className="flex items-center justify-end px-2 text-sm text-muted-foreground">
              {clubs.length} draft clubs
            </div>
          )}
        </div>
        <p className="mt-3 text-xs text-muted-foreground">
          Draft clubs are private and inactive. Review the Advisor and details before publishing one for your school.
        </p>
      </div>

      <p className="text-sm text-muted-foreground" aria-live="polite">
        Showing {filteredClubs.length} of {clubs.length} draft clubs
      </p>

      <div className="grid gap-3 xl:grid-cols-2">
        {filteredClubs.map((club) => (
          <article key={club.id} className="flex h-full flex-col justify-between gap-4 rounded-xl border bg-card p-4">
            <div>
              <div className="flex items-start gap-2">
                <FilePenLine className="mt-0.5 h-4 w-4 shrink-0 text-storm-electric" />
                <div className="min-w-0">
                  <h2 className="font-medium text-foreground">{club.name}</h2>
                  <div className="mt-1 flex flex-wrap items-center gap-2">
                    {club.category && <CategoryBadge category={club.category} />}
                    <span className="text-xs text-muted-foreground">Draft · hidden from students</span>
                  </div>
                </div>
              </div>
              {club.short_description && (
                <p className="mt-3 text-sm text-muted-foreground">{club.short_description}</p>
              )}
            </div>
            <div className="flex flex-wrap justify-end gap-2">
              <Button variant="outline" size="sm" asChild>
                <Link href={`/manage/clubs/${club.slug}`}>
                  {mode === "platform-admin" && (
                    readOnly ? <Eye className="h-4 w-4" /> : <Settings className="h-4 w-4" />
                  )}
                  {readOnly ? "Inspect" : mode === "platform-admin" ? "Dashboard" : "Open workspace"}
                </Link>
              </Button>
              {!readOnly && mode !== "teacher" ? (
                <Button size="sm" asChild>
                  <Link href={`/manage/clubs/${club.slug}/edit?publish=1`}>
                    <Rocket className="h-4 w-4" />
                    Use this club
                  </Link>
                </Button>
              ) : !readOnly ? (
                <Button variant="secondary" size="sm" asChild>
                  <Link href={`/manage/clubs/${club.slug}/edit`}>Awaiting admin review</Link>
                </Button>
              ) : null}
            </div>
          </article>
        ))}
      </div>

      {filteredClubs.length === 0 && (
        <div className="rounded-xl border border-dashed bg-card px-6 py-10 text-center">
          <p className="font-semibold text-foreground">No matching draft clubs</p>
          <p className="mt-1 text-sm text-muted-foreground">Try a different search or category.</p>
          <Button
            type="button"
            variant="outline"
            className="mt-4"
            onClick={() => {
              setQuery("");
              setCategory("all");
            }}
          >
            Clear filters
          </Button>
        </div>
      )}
    </div>
  );
}
