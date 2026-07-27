import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
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
        title="Draft Clubs"
        description="Prepare clubs before publishing them. Draft clubs are hidden from students until they are listed and opened."
      >
        <Button variant="outline" asChild>
          <Link href="/manage/clubs"><ArrowLeft className="h-4 w-4" /> Published clubs</Link>
        </Button>
        <Button asChild>
          <Link href="/manage/clubs/new">Propose club</Link>
        </Button>
      </PageHeader>

      <DraftClubCatalog clubs={clubs} mode={profile.role === "admin" ? "admin" : "teacher"} />
    </div>
  );
}
