import Link from "next/link";
import { ArrowDown, Library, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";

export function ClubCreationOptions({
  customClubHref,
  customClubLabel,
}: {
  customClubHref: string;
  customClubLabel: string;
}) {
  return (
    <section
      aria-labelledby="add-club-options-title"
      className="mb-8 rounded-2xl border bg-card p-5 shadow-sm"
    >
      <div>
        <h2 id="add-club-options-title" className="text-lg font-semibold text-storm-navy">
          Choose how to add the club
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Start with a prepared club below, or create a custom club when the catalog
          does not include what your school needs.
        </p>
      </div>

      <div className="mt-5 grid gap-3 md:grid-cols-2">
        <div className="rounded-xl border border-storm-electric/30 bg-storm-electric/5 p-4">
          <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-storm-electric/10 text-storm-electric">
            <Library className="h-5 w-5" />
          </span>
          <h3 className="mt-3 font-semibold text-storm-navy">Use a starter club</h3>
          <p className="mt-1 text-sm text-muted-foreground">
            Select a prepared draft, review its details and Advisor, then publish it
            for this school.
          </p>
          <Button variant="outline" size="sm" asChild className="mt-4">
            <Link href="#starter-club-catalog">
              Browse starter clubs <ArrowDown className="h-4 w-4" />
            </Link>
          </Button>
        </div>

        <div className="rounded-xl border p-4">
          <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-violet-500/10 text-violet-700 dark:text-violet-300">
            <Plus className="h-5 w-5" />
          </span>
          <h3 className="mt-3 font-semibold text-storm-navy">{customClubLabel}</h3>
          <p className="mt-1 text-sm text-muted-foreground">
            Enter a club name, category, description, and Advisor without using a
            prepared starter.
          </p>
          <Button size="sm" asChild className="mt-4">
            <Link href={customClubHref}>
              {customClubLabel} <Plus className="h-4 w-4" />
            </Link>
          </Button>
        </div>
      </div>
    </section>
  );
}
