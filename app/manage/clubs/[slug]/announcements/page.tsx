import { ContentForm } from "@/components/forms/content-form";
import { PageHeader } from "@/components/layout/page-header";
import { getClubBySlug } from "@/lib/data";
import { requireClubManager } from "@/lib/auth";
import { notFound } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Eye } from "lucide-react";

interface PageProps {
  params: Promise<{ slug: string }>;
}

export default async function ManageAnnouncementsPage({ params }: PageProps) {
  const { slug } = await params;
  const club = await getClubBySlug(slug);
  if (!club) notFound();
  await requireClubManager(club);

  return (
    <div className="container mx-auto px-4 py-8 max-w-2xl">
      <PageHeader title="Create Announcement" description={`For ${club.name} — submissions require approval.`}>
        <Button variant="outline" size="sm" asChild>
          <Link href={`/clubs/${slug}/member`}><Eye className="h-4 w-4" /> View club dashboard</Link>
        </Button>
      </PageHeader>
      <ContentForm type="announcement" clubSlug={slug} />
      <p className="mt-4 text-sm text-muted-foreground">Officer submissions default to pending status until approved by a sponsor or admin.</p>
    </div>
  );
}
