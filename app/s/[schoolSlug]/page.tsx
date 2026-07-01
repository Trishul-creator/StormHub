import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowRight, Calendar, GraduationCap, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ClubCard } from "@/components/clubs/club-card";
import { EmptyState } from "@/components/layout/empty-state";
import { getClubs, getEvents, getOpportunities } from "@/lib/data";
import { getAuthContext } from "@/lib/auth";
import { checkMembership } from "@/lib/actions";
import { getSchoolBySlug } from "@/lib/schools";
import { canJoinClub, canManageClub } from "@/lib/permissions";

interface SchoolWorkspacePageProps {
  params: Promise<{ schoolSlug: string }>;
}

export default async function SchoolWorkspacePage({ params }: SchoolWorkspacePageProps) {
  const { schoolSlug } = await params;
  const school = await getSchoolBySlug(schoolSlug);
  if (!school) notFound();

  const auth = await getAuthContext();
  const [clubs, events, opportunities] = await Promise.all([
    getClubs({ schoolId: school.id, featured: true }),
    getEvents({ schoolId: school.id, upcoming: true }),
    getOpportunities({ schoolId: school.id }),
  ]);
  const membershipChecks = await Promise.all(
    clubs.map(async (club) => ({
      slug: club.slug,
      isMember: auth.userId ? await checkMembership(club.slug, school.id) : false,
    }))
  );
  const membershipMap = Object.fromEntries(membershipChecks.map((item) => [item.slug, item.isMember]));

  return (
    <div>
      <section className="bg-storm-gradient text-white">
        <div className="container mx-auto px-4 py-16 md:py-20">
          <div className="max-w-3xl">
            <p className="text-sm uppercase tracking-wide text-storm-silver">School workspace</p>
            <h1 className="mt-2 text-4xl font-bold tracking-tight md:text-5xl">
              {school.name}
            </h1>
            <p className="mt-4 max-w-2xl text-lg text-storm-silver">
              Clubs, calendar events, opportunities, and updates for this school community.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Button variant="secondary" asChild>
                <Link href={`/s/${school.slug}/clubs`}>Explore clubs <ArrowRight className="h-4 w-4" /></Link>
              </Button>
              <Button variant="outline" className="border-white/30 bg-transparent text-white hover:bg-white/10" asChild>
                <Link href={`/s/${school.slug}/calendar`}>Open calendar</Link>
              </Button>
              <Button variant="outline" className="border-white/30 bg-transparent text-white hover:bg-white/10" asChild>
                <Link href={`/s/${school.slug}/opportunities`}>View opportunities</Link>
              </Button>
            </div>
          </div>
        </div>
      </section>

      <section className="container mx-auto px-4 py-12">
        <div className="grid gap-4 md:grid-cols-3">
          <SummaryCard icon={Users} label="Visible clubs" value={clubs.length} />
          <SummaryCard icon={Calendar} label="Upcoming events" value={events.length} />
          <SummaryCard icon={GraduationCap} label="Opportunities" value={opportunities.length} />
        </div>
      </section>

      <section className="container mx-auto px-4 pb-16">
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold text-storm-navy">Featured clubs</h2>
            <p className="text-sm text-muted-foreground">Visible clubs in {school.short_name || school.name}.</p>
          </div>
          <Button variant="outline" asChild>
            <Link href={`/s/${school.slug}/clubs`}>View all</Link>
          </Button>
        </div>
        {clubs.length === 0 ? (
          <EmptyState title="No public clubs yet" description="This school workspace is ready. Clubs can be added by school admins." />
        ) : (
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {clubs.slice(0, 3).map((club) => (
              <ClubCard
                key={club.id}
                club={club}
                isLoggedIn={auth.isLoggedIn}
                isMember={membershipMap[club.slug]}
                canJoin={canJoinClub(auth.profile, club)}
                canManage={canManageClub(auth.profile, club)}
              />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

function SummaryCard({ icon: Icon, label, value }: { icon: typeof Users; label: string; value: number }) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center gap-3 space-y-0">
        <div className="rounded-lg bg-storm-electric/10 p-2">
          <Icon className="h-5 w-5 text-storm-electric" />
        </div>
        <div>
          <CardTitle className="text-2xl">{value}</CardTitle>
          <CardDescription>{label}</CardDescription>
        </div>
      </CardHeader>
      <CardContent />
    </Card>
  );
}
