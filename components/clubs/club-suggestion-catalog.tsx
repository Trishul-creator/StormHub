"use client";

import { useMemo, useState, useTransition } from "react";
import { Check, Loader2, Search, Send, X } from "lucide-react";
import { requestStarterClub } from "@/lib/actions";
import type { SuggestableClub } from "@/lib/club-suggestions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { CategoryBadge } from "@/components/ui/badge";
import { toast } from "@/hooks/use-toast";

export function ClubSuggestionCatalog({ clubs }: { clubs: SuggestableClub[] }) {
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("all");
  const [requestedIds, setRequestedIds] = useState(
    () => new Set(clubs.filter((club) => club.already_requested).map((club) => club.id))
  );
  const [busyId, setBusyId] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const categories = useMemo(
    () => Array.from(new Set(clubs.map((club) => club.category).filter((value): value is string => Boolean(value)))).sort(),
    [clubs]
  );
  const normalizedQuery = query.trim().toLowerCase();
  const filtered = useMemo(() => clubs.filter((club) => {
    if (category !== "all" && club.category !== category) return false;
    if (!normalizedQuery) return true;
    return [club.name, club.category ?? "", club.short_description ?? "", ...(club.tags ?? [])]
      .some((value) => value.toLowerCase().includes(normalizedQuery));
  }), [category, clubs, normalizedQuery]);

  function request(club: SuggestableClub) {
    setBusyId(club.id);
    startTransition(async () => {
      const result = await requestStarterClub(club.id);
      setBusyId(null);
      if (!result.success) {
        toast({ title: "Could not suggest club", description: result.error, variant: "destructive" });
        return;
      }
      setRequestedIds((current) => new Set(current).add(club.id));
      toast({
        title: "Club suggested",
        description: "Your school administrator can now review this club.",
      });
    });
  }

  return (
    <div className="space-y-5">
      <div className="grid gap-3 rounded-xl border bg-card p-4 shadow-sm md:grid-cols-[minmax(0,1fr)_220px_auto]">
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            aria-label="Search starter clubs"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search clubs, categories, or interests"
            className="pl-9"
          />
        </div>
        <select
          aria-label="Filter starter clubs by category"
          value={category}
          onChange={(event) => setCategory(event.target.value)}
          className="h-10 rounded-lg border border-input bg-card px-3 text-sm text-foreground shadow-sm"
        >
          <option value="all">All categories</option>
          {categories.map((option) => <option key={option} value={option}>{option}</option>)}
        </select>
        {normalizedQuery || category !== "all" ? (
          <Button type="button" variant="ghost" onClick={() => { setQuery(""); setCategory("all"); }}>
            <X className="h-4 w-4" /> Clear
          </Button>
        ) : <span className="self-center text-sm text-muted-foreground">{clubs.length} starters</span>}
      </div>

      <p className="text-sm text-muted-foreground" aria-live="polite">
        Showing {filtered.length} of {clubs.length} starter clubs
      </p>
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {filtered.map((club) => {
          const requested = requestedIds.has(club.id);
          const busy = pending && busyId === club.id;
          return (
            <article key={club.id} className="flex flex-col justify-between gap-4 rounded-xl border bg-card p-4 shadow-sm">
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <h2 className="font-semibold text-foreground">{club.name}</h2>
                  {club.category && <CategoryBadge category={club.category} />}
                </div>
                <p className="mt-2 text-sm text-muted-foreground">
                  {club.short_description || "A prepared club template ready for administrator review."}
                </p>
              </div>
              <Button
                type="button"
                variant={requested ? "outline" : "default"}
                disabled={requested || busy}
                onClick={() => request(club)}
              >
                {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : requested ? <Check className="h-4 w-4" /> : <Send className="h-4 w-4" />}
                {requested ? "Suggested" : "Suggest this club"}
              </Button>
            </article>
          );
        })}
      </div>
      {filtered.length === 0 && (
        <div className="rounded-xl border border-dashed bg-card p-8 text-center text-sm text-muted-foreground">
          No starter clubs match those filters.
        </div>
      )}
    </div>
  );
}
