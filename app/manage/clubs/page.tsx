import Link from "next/link";
import { PageHeader } from "@/components/layout/page-header";
import { CategoryBadge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { getManageableClubs } from "@/lib/data";
import { requireManager } from "@/lib/auth";
import { Settings } from "lucide-react";
import { EmptyState } from "@/components/layout/empty-state";
import { isAdminRole } from "@/lib/permissions";

export default async function ManageClubsPage() {
  const { profile } = await requireManager();
  const clubs = await getManageableClubs(profile);

  return (
    <div className="container mx-auto px-4 py-8">
      <PageHeader title="Manage Clubs" description="Clubs you can manage as an officer or sponsor.">
        {(profile.role === "teacher" || isAdminRole(profile.role)) && (
          <Button asChild><Link href="/manage/clubs/new">Propose club</Link></Button>
        )}
      </PageHeader>
      <div className="space-y-3">
        {clubs.map((club) => (
          <div key={club.id} className="flex items-center justify-between rounded-xl border p-4">
            <div>
              <p className="font-medium">{club.name}</p>
              <div className="mt-1 flex flex-wrap items-center gap-2">
                {club.category && <CategoryBadge category={club.category} />}
                <span className="text-xs capitalize text-muted-foreground">
                  {club.status.replace("_", " ")} · {club.is_listed ? "listed" : "not listed"} · {club.visibility}
                </span>
              </div>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" asChild>
                <Link href={`/manage/clubs/${club.slug}`}><Settings className="h-4 w-4 mr-1" /> Dashboard</Link>
              </Button>
            </div>
          </div>
        ))}
        {clubs.length === 0 && (
          <EmptyState
            title="No clubs to manage"
            description="Officer and sponsor access is based on your active club membership role."
          />
        )}
      </div>
    </div>
  );
}
