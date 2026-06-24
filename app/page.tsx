import Link from "next/link";
import { ArrowRight, Shield, Zap } from "lucide-react";
import { Button } from "@/components/ui/button";
import { FeatureCards } from "@/components/layout/feature-cards";
import { StatCards } from "@/components/layout/stat-cards";
import { ClubCard } from "@/components/clubs/club-card";
import { EventCard } from "@/components/events/event-card";
import { getFeaturedClubs, getEvents, getManageableClubs, getStats } from "@/lib/data";
import { SCHOOL_NAME } from "@/lib/utils";
import { getAuthContext } from "@/lib/auth";

export default async function HomePage() {
  const [featuredClubs, events, stats, auth] = await Promise.all([
    getFeaturedClubs(),
    getEvents({ upcoming: true }),
    getStats(),
    getAuthContext(),
  ]);
  const manageable = auth.profile ? await getManageableClubs(auth.profile) : [];
  const manageableSlugs = new Set(manageable.map((club) => club.slug));

  const upcomingEvents = events.slice(0, 4);

  return (
    <>
      {/* Hero */}
      <section className="bg-storm-gradient text-white">
        <div className="container mx-auto px-4 py-20 md:py-28">
          <div className="max-w-3xl">
            <div className="mb-4 inline-flex items-center gap-2 rounded-full bg-white/10 px-4 py-1.5 text-sm backdrop-blur">
              <Zap className="h-4 w-4 text-storm-electric" />
              Student-built opportunity hub · {SCHOOL_NAME}
            </div>
            <h1 className="text-4xl font-bold tracking-tight md:text-5xl lg:text-6xl text-balance">
              Find your next opportunity at Elkhorn South.
            </h1>
            <p className="mt-6 text-lg text-storm-silver md:text-xl max-w-2xl">
              StormHub brings clubs, meetings, events, applications, tryouts, auditions, workshops, and deadlines into one clear place.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Button size="lg" variant="secondary" asChild>
                <Link href="/clubs">Explore Clubs <ArrowRight className="h-4 w-4" /></Link>
              </Button>
              {auth.profile?.role !== "teacher" && (
                <Button size="lg" variant="outline" className="border-white/30 bg-transparent text-white hover:bg-white/10" asChild>
                  <Link href="/opportunities">View Opportunities</Link>
                </Button>
              )}
              <Button size="lg" variant="outline" className="border-white/30 bg-transparent text-white hover:bg-white/10" asChild>
                <Link href="/calendar">Open Calendar</Link>
              </Button>
            </div>
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="container mx-auto px-4 py-16">
        <h2 className="mb-8 text-2xl font-bold text-storm-navy text-center">Everything in one place</h2>
        <FeatureCards />
      </section>

      {/* Stats */}
      <section className="bg-storm-navy py-16">
        <div className="container mx-auto px-4">
          <h2 className="mb-8 text-center text-2xl font-bold text-white">StormHub at a glance</h2>
          <StatCards {...stats} />
        </div>
      </section>

      {/* Featured Clubs */}
      <section className="container mx-auto px-4 py-16">
        <div className="mb-8 flex items-center justify-between">
          <h2 className="text-2xl font-bold text-storm-navy">Featured clubs</h2>
          <Button variant="outline" asChild>
            <Link href="/clubs">View all clubs <ArrowRight className="h-4 w-4" /></Link>
          </Button>
        </div>
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {featuredClubs.map((club) => (
            <ClubCard
              key={club.id}
              club={club}
              isLoggedIn={auth.isLoggedIn}
              canJoin={auth.profile?.role === "student"}
              canManage={manageableSlugs.has(club.slug)}
            />
          ))}
        </div>
      </section>

      {/* Upcoming calendar items */}
      <section className="bg-storm-subtle py-16">
        <div className="container mx-auto px-4">
          <div className="mb-8 flex items-center justify-between">
            <h2 className="text-2xl font-bold text-storm-navy">Coming up</h2>
            <Button variant="outline" asChild>
              <Link href="/calendar">View calendar <ArrowRight className="h-4 w-4" /></Link>
            </Button>
          </div>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {upcomingEvents.map((event) => (
              <EventCard
                key={event.id}
                event={event}
                isLoggedIn={auth.isLoggedIn}
                canParticipate={auth.profile?.role === "student" || !auth.profile}
              />
            ))}
          </div>
        </div>
      </section>

      {/* Privacy note */}
      <section className="container mx-auto px-4 py-16">
        <div className="rounded-2xl border border-storm-light bg-white p-8 md:p-12 flex flex-col md:flex-row items-start gap-6">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-green-100">
            <Shield className="h-6 w-6 text-green-700" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-storm-navy">Privacy-first and school-safe</h2>
            <p className="mt-2 text-muted-foreground max-w-2xl">
              StormHub is designed to collect only what is needed for club participation and opportunity discovery. It does not store grades, disciplinary records, private messages, or sensitive student information.
            </p>
            <Button variant="link" className="mt-2 px-0" asChild>
              <Link href="/privacy">Read our privacy approach →</Link>
            </Button>
          </div>
        </div>
      </section>
    </>
  );
}
