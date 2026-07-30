import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Calendar, CheckCircle2, MapPin } from "lucide-react";
import { Button } from "@/components/ui/button";
import { CategoryBadge } from "@/components/ui/badge";
import { BookmarkButton } from "@/components/opportunities/bookmark-button";
import { OpportunityParticipationButton } from "@/components/opportunities/opportunity-participation-button";
import { getOpportunityBySlug } from "@/lib/data";
import { getUserBookmarkIds, getUserOpportunitySignupIds } from "@/lib/actions";
import { getAuthContext } from "@/lib/auth";
import { formatDate, isDeadlineSoon, isOverdue, opportunityActionLabel } from "@/lib/utils";
import { PublicDemoNotice } from "@/components/layout/public-demo-notice";

interface OpportunityPageProps {
  params: Promise<{ slug: string }>;
}

export default async function OpportunityPage({ params }: OpportunityPageProps) {
  const { slug } = await params;
  const { userId, isLoggedIn, profile } = await getAuthContext();
  const opportunity = await getOpportunityBySlug(slug);
  if (!opportunity) notFound();

  const canParticipate = profile?.role === "student" || !profile;
  const [bookmarkIds, signedUpIds] = canParticipate
    ? await Promise.all([getUserBookmarkIds(userId), getUserOpportunitySignupIds(userId)])
    : [new Set<string>(), new Set<string>()];
  const isBookmarked = bookmarkIds.has(opportunity.id);
  const isSignedUp = signedUpIds.has(opportunity.id);
  const actionLabel = opportunityActionLabel(opportunity.action_label);
  const isClosed = isOverdue(opportunity.deadline);

  return (
    <div className="container mx-auto px-4 py-8 max-w-4xl">
      {!isLoggedIn && <div className="mb-6"><PublicDemoNotice compact /></div>}
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
          <BookmarkButton
            opportunityId={opportunity.id}
            isLoggedIn={isLoggedIn}
            isBookmarked={isBookmarked}
            inactiveLabel="Save"
            activeLabel="Saved"
            disableWhenBookmarked={false}
          />
        )}
      </div>

      <div data-tour="opportunity-detail" className="grid gap-8 lg:grid-cols-3">
        <div className="lg:col-span-2 space-y-6">
          {isSignedUp && (
            <div className="flex items-center gap-3 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-emerald-900 dark:border-emerald-800 dark:bg-emerald-950/35 dark:text-emerald-200">
              <CheckCircle2 className="h-5 w-5 shrink-0" />
              <div>
                <p className="font-medium">{actionLabel.toLowerCase() === "rsvp" ? "Your RSVP is confirmed" : "You’re signed up"}</p>
                <p className="text-sm text-emerald-800 dark:text-emerald-300">StormHub will keep this opportunity highlighted for you.</p>
              </div>
            </div>
          )}
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

        <div className="sticky top-20 h-fit space-y-4 rounded-xl border bg-card p-6">
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
          {canParticipate && (
            <OpportunityParticipationButton
              opportunityId={opportunity.id}
              opportunitySlug={opportunity.slug}
              actionLabel={actionLabel}
              externalUrl={opportunity.external_url}
              isLoggedIn={isLoggedIn}
              isSignedUp={isSignedUp}
              isClosed={isClosed}
              className="w-full"
            />
          )}
          {!canParticipate && (
            <div className="rounded-lg border border-blue-200 bg-blue-50 p-3 text-sm text-blue-900 dark:border-blue-900/70 dark:bg-blue-950/40 dark:text-blue-200">
              Read-only preview. Participation actions are available only to student accounts.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
