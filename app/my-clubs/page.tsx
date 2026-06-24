import { redirect } from "next/navigation";
import Link from "next/link";
import { getUserMemberships } from "@/lib/data";
import { requireAuth } from "@/lib/auth";
import { PageHeader } from "@/components/layout/page-header";
import { EmptyState } from "@/components/layout/empty-state";
import { ArrowRight } from "lucide-react";

export default async function MyClubsPage() {
  const { userId } = await requireAuth("/my-clubs");

  const memberships = await getUserMemberships(userId);

  return (
    <div className="container mx-auto px-4 py-8">
      <PageHeader title="My Clubs" description="Clubs you've joined at Elkhorn South." />
      {memberships.length === 0 ? (
        <EmptyState title="No clubs yet" description="Browse the club directory and join activities that interest you." actionLabel="Browse clubs" actionHref="/clubs" />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {memberships.map((m) => m.club && (
            <Link
              key={m.id}
              href={`/my-clubs/${m.club.slug}`}
              className="rounded-xl border bg-white p-6 hover:shadow-md transition-shadow flex items-center justify-between"
            >
              <div>
                <h3 className="font-semibold text-storm-navy">{m.club.name}</h3>
                <p className="text-sm text-muted-foreground mt-1">{m.club.category}</p>
                <p className="text-xs text-storm-electric mt-2">Member since {m.joined_at ? new Date(m.joined_at).toLocaleDateString() : "recently"}</p>
              </div>
              <ArrowRight className="h-5 w-5 text-muted-foreground" />
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
