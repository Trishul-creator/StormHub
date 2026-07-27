import Link from "next/link";
import { ArrowRight, Bell, Calendar, GraduationCap, Shield, Users, Zap } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { defaultPathForProfile, getAuthContext } from "@/lib/auth";
import { getSchoolBySlug, getSchoolPublicUrl, getDefaultSchoolSlug } from "@/lib/schools";

export default async function HomePage() {
  const [pilotSchool, auth] = await Promise.all([
    getSchoolBySlug(getDefaultSchoolSlug()),
    getAuthContext(),
  ]);
  const accountPath = defaultPathForProfile(auth.profile);

  return (
    <>
      <section className="bg-storm-gradient text-white">
        <div className="container mx-auto px-4 py-20 md:py-28">
          <div className="max-w-3xl">
            <div className="mb-4 inline-flex items-center gap-2 rounded-full bg-white/10 px-4 py-1.5 text-sm backdrop-blur">
              <Zap className="h-4 w-4 text-storm-electric" />
              Student-built club and opportunity platform
            </div>
            <h1 className="text-4xl font-bold tracking-tight md:text-5xl lg:text-6xl text-balance">
              Club discovery and opportunity management for school communities.
            </h1>
            <p className="mt-6 max-w-2xl text-lg text-storm-silver md:text-xl">
              StormHub helps students discover clubs, track school opportunities, follow events, and stay connected through one organized school workspace.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              {pilotSchool && (
                <Button size="lg" variant="secondary" asChild>
                  <Link href={getSchoolPublicUrl(pilotSchool)}>
                    Explore {pilotSchool.name} <ArrowRight className="h-4 w-4" />
                  </Link>
                </Button>
              )}
              <Button
                size="lg"
                variant={pilotSchool ? "outline" : "secondary"}
                className={pilotSchool ? "border-white/30 bg-transparent text-white hover:bg-white/10" : undefined}
                asChild
              >
                <Link href={auth.isLoggedIn ? accountPath : "/auth/sign-in"}>
                  {auth.isLoggedIn ? "Open dashboard" : "Sign in"}
                </Link>
              </Button>
            </div>
            {pilotSchool && (
              <p className="mt-4 text-sm text-storm-silver">
                Current pilot workspace · Need help?{" "}
                <Link href="/contact" className="underline underline-offset-4">Contact us</Link>
              </p>
            )}
          </div>
        </div>
      </section>

      <section className="container mx-auto px-4 py-16">
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="text-2xl font-bold text-storm-navy">One workspace for school activity</h2>
          <p className="mt-3 text-muted-foreground">
            StormHub keeps school clubs, calendars, signups, resources, and important notifications organized without creating a public social feed or student messaging system.
          </p>
        </div>
        <div className="mt-10 grid gap-6 md:grid-cols-2 lg:grid-cols-4">
          <PlatformCard icon={Users} title="Clubs" description="Students find clubs; sponsors and leaders keep club portals organized." />
          <PlatformCard icon={Calendar} title="Calendar" description="Meetings, deadlines, auditions, and competitions are visible in one place." />
          <PlatformCard icon={GraduationCap} title="Opportunities" description="Schools publish interest forms, tryouts, applications, and deadline-based items." />
          <PlatformCard icon={Bell} title="Notifications" description="Normal updates stay in-app. Important or urgent updates can also be emailed." />
        </div>
      </section>

      <section className="bg-storm-subtle py-16">
        <div className="container mx-auto px-4">
          <div className="rounded-2xl border bg-card p-8 shadow-sm md:p-12">
            <div className="flex flex-col gap-6 md:flex-row md:items-start">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-green-100">
                <Shield className="h-6 w-6 text-green-700" />
              </div>
              <div>
                <h2 className="text-xl font-bold text-storm-navy">Privacy-first and school-safe</h2>
                <p className="mt-2 max-w-3xl text-muted-foreground">
                  StormHub is designed around school workspaces and role-based access. Students see their school’s clubs and opportunities, school admins manage their own school, and platform admins manage school setup separately.
                </p>
                <Button variant="link" className="mt-2 px-0" asChild>
                  <Link href="/privacy">Read our privacy approach →</Link>
                </Button>
              </div>
            </div>
          </div>
        </div>
      </section>
    </>
  );
}

function PlatformCard({
  icon: Icon,
  title,
  description,
}: {
  icon: typeof Users;
  title: string;
  description: string;
}) {
  return (
    <Card className="h-full">
      <CardHeader>
        <div className="mb-2 flex h-10 w-10 items-center justify-center rounded-lg bg-storm-electric/10">
          <Icon className="h-5 w-5 text-storm-electric" />
        </div>
        <CardTitle className="text-lg">{title}</CardTitle>
      </CardHeader>
      <CardContent>
        <CardDescription>{description}</CardDescription>
      </CardContent>
    </Card>
  );
}
