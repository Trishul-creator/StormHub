import Link from "next/link";
import { notFound } from "next/navigation";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { getClubBySlug, getClubMemberCount, getMemberClubData } from "@/lib/data";
import { requireClubManager } from "@/lib/auth";
import { Users, Megaphone, Calendar, FileText, Pencil, Eye, ArrowRight } from "lucide-react";
import { formatDate } from "@/lib/utils";

interface ManageClubPageProps {
  params: Promise<{ slug: string }>;
}

export default async function ManageClubDashboard({ params }: ManageClubPageProps) {
  const { slug } = await params;
  const club = await getClubBySlug(slug);
  if (!club) notFound();
  const auth = await requireClubManager(club);
  const [memberCount, dashboard] = await Promise.all([
    getClubMemberCount(club.id),
    getMemberClubData(slug, auth.userId),
  ]);

  const links = [
    { href: `/manage/clubs/${slug}/edit`, icon: Pencil, label: "Edit profile" },
    { href: `/manage/clubs/${slug}/announcements`, icon: Megaphone, label: "Announcements" },
    { href: `/manage/clubs/${slug}/events`, icon: Calendar, label: "Events" },
    { href: `/manage/clubs/${slug}/resources`, icon: FileText, label: "Resources" },
    { href: `/manage/clubs/${slug}/members`, icon: Users, label: "Members" },
    { href: `/clubs/${slug}/member`, icon: Eye, label: "View club dashboard" },
  ];

  return (
    <div className="container mx-auto px-4 py-8">
      <PageHeader title={`Manage: ${club.name}`} description="Club management dashboard">
        <Button size="sm" asChild>
          <Link href={`/clubs/${slug}/member`}>
            <Eye className="h-4 w-4" /> View club dashboard
          </Link>
        </Button>
        <Button variant="outline" size="sm" asChild>
          <Link href={`/clubs/${slug}`}>View public page</Link>
        </Button>
      </PageHeader>

      <div className="mb-6 rounded-xl bg-storm-gradient p-6 text-white">
        <p className="text-3xl font-bold">{memberCount}</p>
        <p className="text-storm-silver">Active members</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {links.map((link) => (
          <Link key={link.href} href={link.href} className="rounded-xl border p-6 hover:shadow-md transition-shadow flex items-center gap-3">
            <link.icon className="h-5 w-5 text-storm-electric" />
            <span className="font-medium">{link.label}</span>
          </Link>
        ))}
      </div>

      <div className="mt-8 grid gap-6 lg:grid-cols-3">
        <section className="rounded-xl border bg-white p-5">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="font-semibold text-storm-navy">Recent announcements</h2>
            <Button variant="ghost" size="sm" asChild>
              <Link href={`/clubs/${slug}/member`}>View <ArrowRight className="h-3.5 w-3.5" /></Link>
            </Button>
          </div>
          <div className="space-y-3">
            {dashboard?.announcements.slice(0, 3).map((announcement) => (
              <div key={announcement.id} className="rounded-lg border p-3">
                <p className="text-sm font-medium">{announcement.title}</p>
                {announcement.published_at && (
                  <p className="mt-1 text-xs text-muted-foreground">{formatDate(announcement.published_at)}</p>
                )}
              </div>
            ))}
            {!dashboard?.announcements.length && (
              <p className="text-sm text-muted-foreground">No announcements yet.</p>
            )}
          </div>
        </section>

        <section className="rounded-xl border bg-white p-5">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="font-semibold text-storm-navy">Upcoming calendar</h2>
            <Button variant="ghost" size="sm" asChild>
              <Link href="/calendar">Calendar <ArrowRight className="h-3.5 w-3.5" /></Link>
            </Button>
          </div>
          <div className="space-y-3">
            {dashboard?.events.slice(0, 3).map((event) => (
              <Link key={event.id} href={`/events/${event.id}`} className="block rounded-lg border p-3 hover:bg-storm-light/30">
                <p className="text-sm font-medium">{event.title}</p>
                <p className="mt-1 text-xs text-muted-foreground">{formatDate(event.starts_at)}</p>
              </Link>
            ))}
            {!dashboard?.events.length && (
              <p className="text-sm text-muted-foreground">No events scheduled.</p>
            )}
          </div>
        </section>

        <section className="rounded-xl border bg-white p-5">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="font-semibold text-storm-navy">Member resources</h2>
            <Button variant="ghost" size="sm" asChild>
              <Link href={`/clubs/${slug}/member`}>View <ArrowRight className="h-3.5 w-3.5" /></Link>
            </Button>
          </div>
          <div className="space-y-3">
            {dashboard?.resources.slice(0, 3).map((resource) => (
              <div key={resource.id} className="rounded-lg border p-3">
                <p className="text-sm font-medium">{resource.title}</p>
                {resource.description && (
                  <p className="mt-1 text-xs text-muted-foreground line-clamp-2">{resource.description}</p>
                )}
              </div>
            ))}
            {!dashboard?.resources.length && (
              <p className="text-sm text-muted-foreground">No resources posted.</p>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}
