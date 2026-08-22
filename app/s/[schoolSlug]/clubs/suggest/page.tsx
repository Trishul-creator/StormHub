import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { ClubSuggestionCatalog } from "@/components/clubs/club-suggestion-catalog";
import { ClubProposalForm } from "@/components/manage/club-proposal-form";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { requireAuth } from "@/lib/auth";
import { getSuggestableClubCatalog } from "@/lib/club-suggestions";
import { getSchoolBySlugForViewer } from "@/lib/schools";

export default async function SuggestClubPage({ params }: { params: Promise<{ schoolSlug: string }> }) {
  const { profile } = await requireAuth("/clubs");
  if (!["student", "teacher"].includes(profile.role)) redirect("/clubs");
  const { schoolSlug } = await params;
  const school = await getSchoolBySlugForViewer(schoolSlug, profile);
  if (!school || profile.school_id !== school.id) notFound();
  const clubs = await getSuggestableClubCatalog(profile, school);
  const returnHref = `/s/${school.slug}/clubs`;

  return (
    <div className="container mx-auto max-w-6xl px-4 py-8">
      <PageHeader
        title={`Suggest a club for ${school.short_name || school.name}`}
        description="Choose a prepared starter or describe your own idea. Your school administrator reviews every suggestion before the club becomes visible."
      >
        <Button variant="outline" asChild>
          <Link href={returnHref}><ArrowLeft className="h-4 w-4" /> Club directory</Link>
        </Button>
      </PageHeader>

      <section className="mb-10" aria-labelledby="starter-suggestions-title">
        <h2 id="starter-suggestions-title" className="mb-1 text-xl font-semibold text-storm-navy">Starter club catalog</h2>
        <p className="mb-4 text-sm text-muted-foreground">Suggest one of these prepared club templates for administrator review.</p>
        <ClubSuggestionCatalog clubs={clubs} />
      </section>

      <section className="border-t pt-8" aria-labelledby="custom-suggestion-title">
        <h2 id="custom-suggestion-title" className="mb-1 text-xl font-semibold text-storm-navy">Suggest your own club</h2>
        <p className="mb-4 text-sm text-muted-foreground">Use this when the club is not already in the starter catalog.</p>
        <ClubProposalForm
          requiresApproval
          targetSchoolId={school.id}
          returnHref={returnHref}
          successHref={returnHref}
        />
      </section>
    </div>
  );
}
