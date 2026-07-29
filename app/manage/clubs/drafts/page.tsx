import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { ClubCreationOptions } from "@/components/manage/club-creation-options";
import { DraftClubCatalog } from "@/components/manage/draft-club-catalog";
import { requireManager } from "@/lib/auth";
import { getManageableClubs } from "@/lib/data";

export default async function DraftClubsPage() {
  const { profile } = await requireManager();
  if (profile.role === "super_admin") redirect("/admin/schools");

  const clubs = (await getManageableClubs(profile)).filter((club) => club.status === "draft");

  return (
    <div className="container mx-auto px-4 py-8">
      <PageHeader
        title="Add a Club"
        description="Use a prepared starter or create a custom club for your school. Every club stays private until a school administrator publishes it."
      >
        <Button variant="outline" asChild>
          <Link href="/manage/clubs"><ArrowLeft className="h-4 w-4" /> Published clubs</Link>
        </Button>
      </PageHeader>

      <ClubCreationOptions
        customClubHref="/manage/clubs/new"
        customClubLabel={profile.role === "admin" ? "Create a custom club" : "Propose a custom club"}
      />

      <section id="starter-club-catalog" className="scroll-mt-24" aria-labelledby="starter-club-catalog-title">
        <div className="mb-4">
          <h2 id="starter-club-catalog-title" className="text-xl font-semibold text-storm-navy">
            Starter club catalog
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Open any draft below to customize it. Administrators can review and publish it for this school.
          </p>
        </div>
        <DraftClubCatalog clubs={clubs} mode={profile.role === "admin" ? "admin" : "teacher"} />
      </section>
    </div>
  );
}
