import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Calendar, MapPin, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import { CategoryBadge } from "@/components/ui/badge";
import { BookmarkButton } from "@/components/opportunities/bookmark-button";
import { getOpportunityBySlug } from "@/lib/data";
import { getUserBookmarkIds } from "@/lib/actions";
import { getAuthContext } from "@/lib/auth";
import { formatDate, isDeadlineSoon } from "@/lib/utils";

interface OpportunityPageProps {
  params: Promise<{ slug: string }>;
}

export default async function OpportunityPage({ params }: OpportunityPageProps) {
  const { slug } = await params;
  const { userId, isLoggedIn, profile } = await getAuthContext();
  if (profile?.role === "teacher") redirect("/calendar");
  const opportunity = await getOpportunityBySlug(slug);
  if (!opportunity) notFound();

  const canParticipate = profile?.role === "student" || !profile;
  const bookmarkIds = canParticipate ? await getUserBookmarkIds(userId) : new Set<string>();
  const isBookmarked = bookmarkIds.has(opportunity.id);

  return (
    <div className="container mx-auto px-4 py-8 max-w-4xl">
      <Button variant="ghost" size="sm" asChild className="mb-4">
        <Link href="/opportunities"><ArrowLeft className="h-4 w-4 mr-1" /> All opportunities</Link>
      </Button>

      <div className="flex flex-wrap items-start justify-between gap-4 mb-6">
        <div>
          {opportunity.category && <CategoryBadge category={opportunity.category} />}
          <h1 className="mt-2 text-3xl font-bold text-storm-navy">{opportunity.title}</h1>
          {opportunity.summary && <p className="mt-2 text-lg text-muted-foreground">{opportunity.summary}</p>}
        </div>
        {canParticipate && (
          <BookmarkButton opportunityId={opportunity.id} isLoggedIn={isLoggedIn} isBookmarked={isBookmarked} />
        )}
      </div>

      <div className="grid gap-8 lg:grid-cols-3">
        <div className="lg:col-span-2 space-y-6">
          <div className="prose prose-sm max-w-none">
            <p className="text-muted-foreground leading-relaxed whitespace-pre-wrap">{opportunity.description}</p>
          </div>

          {opportunity.tags && opportunity.tags.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {opportunity.tags.map((tag) => (
                <span key={tag} className="rounded-full bg-storm-light px-3 py-1 text-xs">{tag}</span>
              ))}
            </div>
          )}

        </div>

        <div className="rounded-xl border bg-white p-6 h-fit sticky top-20 space-y-4">
          {opportunity.deadline && (
            <div>
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Deadline</p>
              <p className={`flex items-center gap-1.5 mt-1 font-medium ${isDeadlineSoon(opportunity.deadline) ? "text-amber-700" : "text-storm-navy"}`}>
                <Calendar className="h-4 w-4" />
                {formatDate(opportunity.deadline)}
              </p>
            </div>
          )}
          {opportunity.event_date && (
            <div>
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Date</p>
              <p className="mt-1 flex items-center gap-1.5 font-medium text-storm-navy">
                <Calendar className="h-4 w-4" />
                {formatDate(opportunity.event_date)}
              </p>
            </div>
          )}
          {opportunity.eligibility && (
            <div>
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Eligibility</p>
              <p className="mt-1 text-sm">{opportunity.eligibility}</p>
            </div>
          )}
          {opportunity.location && (
            <div>
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Location</p>
              <p className="mt-1 text-sm flex items-center gap-1"><MapPin className="h-3.5 w-3.5" />{opportunity.location}</p>
            </div>
          )}
          {opportunity.external_url && canParticipate && (
            <Button asChild className="w-full">
              <a href={opportunity.external_url} target="_blank" rel="noopener noreferrer">
                {opportunity.action_label || "Learn more"} <ExternalLink className="h-4 w-4" />
              </a>
            </Button>
          )}
          {!canParticipate && (
            <div className="rounded-lg border border-blue-200 bg-blue-50 p-3 text-sm text-blue-900">
              Administrator preview. Student sign-up actions are disabled for administrator accounts.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
