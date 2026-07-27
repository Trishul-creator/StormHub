import { notFound } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft,
  BookOpen,
  Calendar,
  FileText,
  Link as LinkIcon,
  Megaphone,
  Settings,
  ShieldCheck,
  Users,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { EventCard } from "@/components/events/event-card";
import { AssignmentCard } from "@/components/coursework/assignment-card";
import { ClubWorkspaceNav } from "@/components/coursework/club-workspace-nav";
import { EmptyState } from "@/components/layout/empty-state";
import { getMemberClubData } from "@/lib/data";
import { getUserRsvpIds } from "@/lib/actions";
import { formatDateTime } from "@/lib/utils";
import { LeaveClubButton } from "@/components/clubs/leave-club-button";
import { MemberBlocked } from "@/components/clubs/member-blocked";
import { canManageClub } from "@/lib/permissions";
import { getSchoolById } from "@/lib/schools";
import type { ClubMemberDirectoryEntry } from "@/types/database";
import { clubRoleLabel } from "@/lib/club-roles";

type WorkspaceView = "stream" | "classwork" | "people";

interface MemberPageProps {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ view?: string }>;
}

export default async function MemberClubPage({ params, searchParams }: MemberPageProps) {
  const [{ slug }, query] = await Promise.all([params, searchParams]);
  const auth = await getAuthContextSafe();

  if (!auth.isLoggedIn) {
    const { redirect } = await import("next/navigation");
    redirect(`/auth/sign-in?redirect=/clubs/${slug}/member`);
  }

  const club = await getClubBySlugSafe(slug);
  if (!club) notFound();

  const school = await getSchoolById(club.school_id);
  const publicHref = school ? `/s/${school.slug}/clubs/${club.slug}` : `/clubs/${slug}`;
  const isPubliclyVisible =
    club.is_listed &&
    club.visibility === "public" &&
    ["interest_open", "active"].includes(club.status);
  const membership = auth.userId
    ? await getUserClubMembershipSafe(auth.userId, club.id)
    : null;
  const isMember = Boolean(membership);
  const isManagerPreview = canManageClub(auth.profile, club, membership);

  if (!isMember && !isManagerPreview) {
    return <MemberBlocked clubSlug={slug} clubName={club.name} isLoggedIn publicHref={publicHref} />;
  }

  const data = await getMemberClubData(slug, auth.userId, club);
  if (!data) notFound();

  const { announcements, resources, events, assignments, directory } = data;
  const rsvpIds = auth.profile?.role === "student" ? await getUserRsvpIds(auth.userId) : new Set<string>();
  const activeView: WorkspaceView = ["classwork", "people"].includes(query.view ?? "")
    ? query.view as WorkspaceView
    : "stream";

  return (
    <div className="container mx-auto max-w-7xl px-4 py-8">
      <Button variant="ghost" size="sm" asChild className="mb-4">
        <Link href={isPubliclyVisible ? publicHref : `/manage/clubs/${slug}`}>
          <ArrowLeft className="mr-1 h-4 w-4" />
          {isPubliclyVisible ? "Public page" : "Back to management"}
        </Link>
      </Button>

      <div className="motion-block mb-1 overflow-hidden rounded-2xl bg-storm-gradient text-white shadow-lg">
        <div className="p-6 sm:p-8">
          <div className="flex flex-col gap-6 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <div className="mb-2 flex flex-wrap items-center gap-2 text-sm text-storm-silver">
                <span>{isManagerPreview ? "Club workspace preview" : "Club workspace"}</span>
                {membership?.role && (
                  <>
                    <span aria-hidden="true">·</span>
                    <span className="capitalize">{membership.role}</span>
                  </>
                )}
              </div>
              <h1 className="text-3xl font-bold">{club.name}</h1>
              <p className="mt-3 max-w-2xl text-sm leading-relaxed text-storm-silver">
                {club.short_description || "Assignments, club updates, people, events, and shared materials in one place."}
              </p>
            </div>
            <div className="flex shrink-0 flex-wrap gap-2">
              {isManagerPreview && (
                <Button variant="secondary" asChild>
                  <Link href={`/manage/clubs/${slug}`}>
                    <Settings className="h-4 w-4" /> Manage club
                  </Link>
                </Button>
              )}
              {isMember && auth.profile?.role === "student" && !isManagerPreview && (
                <LeaveClubButton clubSlug={slug} />
              )}
            </div>
          </div>
        </div>
      </div>

      <ClubWorkspaceNav
        clubSlug={slug}
        activeView={activeView}
        assignmentCount={assignments.length}
        memberCount={directory.length}
      />

      {activeView === "stream" && (
        <StreamView
          slug={slug}
          assignments={assignments}
          announcements={announcements}
          events={events}
          resources={resources}
          rsvpIds={rsvpIds}
          isStudent={auth.profile?.role === "student"}
        />
      )}

      {activeView === "classwork" && (
        <section>
          <div className="mb-5">
            <h2 className="text-2xl font-semibold text-storm-navy">Classwork</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              View instructions, turn in work, and see returned grades and feedback.
            </p>
          </div>
          {assignments.length === 0 ? (
            <EmptyState
              title="No classwork yet"
              description="Assignments from club leadership will appear here."
            />
          ) : (
            <div className="motion-stagger grid gap-5 lg:grid-cols-2">
              {assignments.map((assignment) => (
                <AssignmentCard
                  key={assignment.id}
                  assignment={assignment}
                  href={`/clubs/${slug}/member/assignments/${assignment.id}`}
                />
              ))}
            </div>
          )}
        </section>
      )}

      {activeView === "people" && <PeopleView directory={directory} />}
    </div>
  );
}

function StreamView({
  slug,
  assignments,
  announcements,
  events,
  resources,
  rsvpIds,
  isStudent,
}: {
  slug: string;
  assignments: Awaited<ReturnType<typeof getMemberClubData>> extends infer Data
    ? Data extends { assignments: infer Assignments } ? Assignments : never
    : never;
  announcements: Awaited<ReturnType<typeof getMemberClubData>> extends infer Data
    ? Data extends { announcements: infer Announcements } ? Announcements : never
    : never;
  events: Awaited<ReturnType<typeof getMemberClubData>> extends infer Data
    ? Data extends { events: infer Events } ? Events : never
    : never;
  resources: Awaited<ReturnType<typeof getMemberClubData>> extends infer Data
    ? Data extends { resources: infer Resources } ? Resources : never
    : never;
  rsvpIds: Set<string>;
  isStudent: boolean;
}) {
  return (
    <div className="grid gap-8 lg:grid-cols-[minmax(0,2fr)_minmax(18rem,1fr)]">
      <div className="min-w-0 space-y-10">
        <section>
          <div className="mb-4 flex items-end justify-between gap-4">
            <div>
              <h2 className="flex items-center gap-2 text-xl font-semibold text-storm-navy">
                <BookOpen className="h-5 w-5 text-storm-electric" /> Upcoming classwork
              </h2>
              <p className="mt-1 text-sm text-muted-foreground">Assignments and returned work for this club.</p>
            </div>
            <Button variant="ghost" size="sm" asChild>
              <Link href={`/clubs/${slug}/member?view=classwork`}>View all</Link>
            </Button>
          </div>
          {assignments.length === 0 ? (
            <div className="rounded-xl border border-dashed bg-white p-6 text-sm text-muted-foreground">
              No assignments have been posted.
            </div>
          ) : (
            <div className="motion-stagger grid gap-4 md:grid-cols-2">
              {assignments.slice(0, 4).map((assignment) => (
                <AssignmentCard
                  key={assignment.id}
                  assignment={assignment}
                  href={`/clubs/${slug}/member/assignments/${assignment.id}`}
                />
              ))}
            </div>
          )}
        </section>

        <section>
          <h2 className="mb-4 flex items-center gap-2 text-xl font-semibold text-storm-navy">
            <Megaphone className="h-5 w-5 text-storm-electric" /> Announcements
          </h2>
          {announcements.length === 0 ? (
            <div className="rounded-xl border border-dashed bg-white p-6 text-sm text-muted-foreground">
              No announcements yet.
            </div>
          ) : (
            <div className="motion-stagger space-y-3">
              {announcements.map((announcement) => (
                <Card key={announcement.id}>
                  <CardContent className="p-5">
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <h3 className="font-semibold text-storm-navy">{announcement.title}</h3>
                      {announcement.visibility === "members" && (
                        <span className="rounded-full bg-storm-electric/10 px-2.5 py-1 text-xs font-medium text-storm-electric">
                          Members only
                        </span>
                      )}
                    </div>
                    <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-muted-foreground">
                      {announcement.body}
                    </p>
                    <p className="mt-3 text-xs text-muted-foreground">
                      Posted {formatDateTime(announcement.published_at ?? announcement.created_at)}
                    </p>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </section>

        {events.length > 0 && (
          <section>
            <h2 className="mb-4 flex items-center gap-2 text-xl font-semibold text-storm-navy">
              <Calendar className="h-5 w-5 text-storm-electric" /> Club events
            </h2>
            <div className="motion-stagger grid gap-4 sm:grid-cols-2">
              {events.map((event) => (
                <EventCard
                  key={event.id}
                  event={event}
                  isLoggedIn
                  hasRsvp={rsvpIds.has(event.id)}
                  canParticipate={isStudent}
                />
              ))}
            </div>
          </section>
        )}
      </div>

      <aside>
        <section className="sticky top-24 rounded-2xl border bg-white p-5 shadow-sm">
          <h2 className="flex items-center gap-2 text-lg font-semibold text-storm-navy">
            <FileText className="h-5 w-5 text-storm-electric" /> Materials
          </h2>
          {resources.length === 0 ? (
            <p className="mt-4 text-sm text-muted-foreground">No materials posted yet.</p>
          ) : (
            <ul className="mt-4 space-y-3">
              {resources.map((resource) => (
                <li key={resource.id} className="rounded-xl border p-3 transition-colors hover:bg-storm-light/25">
                  <p className="text-sm font-medium text-storm-navy">{resource.title}</p>
                  {resource.description && (
                    <p className="mt-1 text-xs text-muted-foreground">{resource.description}</p>
                  )}
                  {resource.resource_type === "link" && resource.url && (
                    <a
                      href={resource.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="mt-2 flex items-center gap-1 text-xs font-medium text-storm-electric hover:underline"
                    >
                      <LinkIcon className="h-3 w-3" /> {resource.content || "Open material"}
                    </a>
                  )}
                  {resource.resource_type === "text" && resource.content && (
                    <p className="mt-2 text-xs text-muted-foreground">{resource.content}</p>
                  )}
                </li>
              ))}
            </ul>
          )}
        </section>
      </aside>
    </div>
  );
}

function PeopleView({ directory }: { directory: ClubMemberDirectoryEntry[] }) {
  const sponsors = directory.filter((member) => member.membership_role === "sponsor");
  const studentLeaders = directory.filter((member) =>
    ["president", "officer"].includes(member.membership_role)
  );
  const members = directory.filter((member) => member.membership_role === "member");

  return (
    <section className="max-w-4xl">
      <div className="mb-6">
        <h2 className="text-2xl font-semibold text-storm-navy">People</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Everyone currently joined to this club. Email addresses remain private.
        </p>
      </div>

      <div className="space-y-8">
        <DirectoryGroup
          title="Advisors"
          icon={ShieldCheck}
          members={sponsors}
          emptyMessage="No Advisor is currently listed."
        />
        {studentLeaders.length > 0 && (
          <DirectoryGroup title="Student leaders" icon={Users} members={studentLeaders} />
        )}
        <DirectoryGroup
          title={`Members · ${members.length}`}
          icon={Users}
          members={members}
          emptyMessage="No student members yet."
        />
      </div>
    </section>
  );
}

function DirectoryGroup({
  title,
  icon: Icon,
  members,
  emptyMessage,
}: {
  title: string;
  icon: typeof Users;
  members: ClubMemberDirectoryEntry[];
  emptyMessage?: string;
}) {
  return (
    <div>
      <h3 className="mb-3 flex items-center gap-2 font-semibold text-storm-navy">
        <Icon className="h-4 w-4 text-storm-electric" /> {title}
      </h3>
      {members.length === 0 ? (
        <p className="rounded-xl border border-dashed bg-white p-5 text-sm text-muted-foreground">
          {emptyMessage}
        </p>
      ) : (
        <div className="motion-stagger grid gap-3 sm:grid-cols-2">
          {members.map((member) => (
            <Card key={member.user_id}>
              <CardContent className="flex items-center gap-3 p-4">
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-storm-gradient font-semibold text-white">
                  {initials(member.full_name)}
                </div>
                <div className="min-w-0">
                  <p className="truncate font-medium text-storm-navy">{member.full_name}</p>
                  <p className="text-xs capitalize text-muted-foreground">
                    {clubRoleLabel(member.membership_role)}
                  </p>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("") || "?";
}

async function getAuthContextSafe() {
  const { getAuthContext } = await import("@/lib/auth");
  return getAuthContext();
}

async function getClubBySlugSafe(slug: string) {
  const { getManagedClubBySlug } = await import("@/lib/data");
  return getManagedClubBySlug(slug);
}

async function getUserClubMembershipSafe(userId: string, clubId: string) {
  const { getUserClubMembership } = await import("@/lib/data");
  return getUserClubMembership(userId, clubId);
}
