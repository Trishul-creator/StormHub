import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, FileText, Link as LinkIcon, BookOpen } from "lucide-react";
import { Button } from "@/components/ui/button";
import { EventCard } from "@/components/events/event-card";
import { getMemberClubData } from "@/lib/data";
import { checkMembership, getUserRsvpIds } from "@/lib/actions";
import { requireAuth } from "@/lib/auth";
import { formatDateTime } from "@/lib/utils";
import { LeaveClubButton } from "@/components/clubs/leave-club-button";
import { MemberBlocked } from "@/components/clubs/member-blocked";
import { canManageClub } from "@/lib/permissions";

interface MemberPageProps {
  params: Promise<{ slug: string }>;
}

export default async function MemberClubPage({ params }: MemberPageProps) {
  const { slug } = await params;
  const auth = await getAuthContextSafe();

  if (!auth.isLoggedIn) {
    const { redirect } = await import("next/navigation");
    redirect(`/auth/sign-in?redirect=/clubs/${slug}/member`);
  }

  const isMember = await checkMembership(slug);
  const club = await getClubBySlugSafe(slug);

  if (!club) notFound();

  const membership = auth.userId
    ? await getUserClubMembershipSafe(auth.userId, club.id)
    : null;
  const isManagerPreview = canManageClub(auth.profile, club, membership);
  if (!isMember && !isManagerPreview) {
    return <MemberBlocked clubSlug={slug} clubName={club.name} isLoggedIn />;
  }

  const data = await getMemberClubData(slug, auth.userId);
  if (!data) notFound();

  const { announcements, resources, events } = data;
  const rsvpIds = auth.profile?.role === "student" ? await getUserRsvpIds(auth.userId) : new Set<string>();

  return (
    <div className="container mx-auto px-4 py-8">
      <Button variant="ghost" size="sm" asChild className="mb-4">
        <Link href={`/clubs/${slug}`}><ArrowLeft className="h-4 w-4 mr-1" /> Public page</Link>
      </Button>

      <div className="mb-8 rounded-2xl bg-storm-gradient p-6 text-white">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-sm text-storm-silver mb-1">
              {isManagerPreview ? "Club dashboard preview" : "Member area"}
            </p>
            <h1 className="text-2xl font-bold">{club.name}</h1>
            <p className="mt-2 text-storm-silver text-sm max-w-xl">
              {isManagerPreview
                ? "This is the complete club dashboard members see, including internal announcements, events, and resources."
                : "This page is visible because you joined this club. Check here for resources, meeting details, internal announcements, and next steps."}
            </p>
          </div>
          {isManagerPreview ? (
            <Button variant="secondary" asChild>
              <Link href={`/manage/clubs/${slug}`}>Return to management</Link>
            </Button>
          ) : (
            <LeaveClubButton clubSlug={slug} />
          )}
        </div>
      </div>

      <div className="grid gap-8 lg:grid-cols-3">
        <div className="lg:col-span-2 space-y-8">
          <section>
            <h2 className="text-xl font-semibold text-storm-navy mb-4 flex items-center gap-2">
              <BookOpen className="h-5 w-5" /> Announcements
            </h2>
            {announcements.length === 0 ? (
              <p className="text-sm text-muted-foreground">No announcements yet.</p>
            ) : (
              <div className="space-y-3">
                {announcements.map((a) => (
                  <div key={a.id} className="rounded-xl border p-4">
                    <div className="flex items-center gap-2 mb-1">
                      <h3 className="font-medium">{a.title}</h3>
                      {a.visibility === "members" && (
                        <span className="rounded bg-storm-electric/10 px-2 py-0.5 text-xs text-storm-electric">Members only</span>
                      )}
                    </div>
                    <p className="text-sm text-muted-foreground">{a.body}</p>
                    <p className="mt-2 text-xs text-muted-foreground">
                      Posted {formatDateTime(a.published_at ?? a.created_at)}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </section>

          {events.length > 0 && (
            <section>
              <h2 className="text-xl font-semibold text-storm-navy mb-4">Club events</h2>
              <div className="grid gap-4 sm:grid-cols-2">
                {events.map((event) => (
                  <EventCard
                    key={event.id}
                    event={event}
                    isLoggedIn
                    hasRsvp={rsvpIds.has(event.id)}
                    canParticipate={auth.profile?.role === "student"}
                  />
                ))}
              </div>
            </section>
          )}

        </div>

        <div>
          <section className="rounded-xl border bg-white p-6 sticky top-20">
            <h2 className="text-lg font-semibold text-storm-navy mb-4 flex items-center gap-2">
              <FileText className="h-5 w-5" /> Resources
            </h2>
            {resources.length === 0 ? (
              <p className="text-sm text-muted-foreground">No resources posted yet.</p>
            ) : (
              <ul className="space-y-3">
                {resources.map((r) => (
                  <li key={r.id} className="rounded-lg border p-3 hover:bg-storm-light/30 transition-colors">
                    <p className="font-medium text-sm">{r.title}</p>
                    {r.description && <p className="text-xs text-muted-foreground mt-0.5">{r.description}</p>}
                    {r.resource_type === "link" && r.url && (
                      <a
                        href={r.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="mt-1 flex items-center gap-1 text-xs text-storm-electric hover:underline"
                      >
                        <LinkIcon className="h-3 w-3" /> {r.content || "Open resource"}
                      </a>
                    )}
                    {r.resource_type === "text" && r.content && (
                      <p className="mt-1 text-xs text-muted-foreground">{r.content}</p>
                    )}
                  </li>
                ))}
              </ul>
            )}

            <hr className="my-4" />
            <div className="text-sm text-muted-foreground">
              <p className="font-medium text-storm-navy mb-1">Officer / Sponsor</p>
              <p>{club.sponsor_name || "Contact sponsor — TBD"}</p>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}

async function getAuthContextSafe() {
  const { getAuthContext } = await import("@/lib/auth");
  return getAuthContext();
}

async function getClubBySlugSafe(slug: string) {
  const { getClubBySlug } = await import("@/lib/data");
  return getClubBySlug(slug);
}

async function getUserClubMembershipSafe(userId: string, clubId: string) {
  const { getUserClubMembership } = await import("@/lib/data");
  return getUserClubMembership(userId, clubId);
}
