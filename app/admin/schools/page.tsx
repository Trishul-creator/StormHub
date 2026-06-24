import { PageHeader } from "@/components/layout/page-header";
import { requireAdmin } from "@/lib/auth";
import { getSchool } from "@/lib/data";
import { EmptyState } from "@/components/layout/empty-state";

export default async function AdminSchoolsPage() {
  await requireAdmin();
  const school = await getSchool();

  return (
    <div className="container mx-auto px-4 py-8 max-w-2xl">
      <PageHeader title="Schools" description="Multi-school support — currently single school." />
      {school ? <div className="rounded-xl border p-6">
        <h3 className="font-semibold text-storm-navy">{school.name}</h3>
        <dl className="mt-4 space-y-2 text-sm">
          <div className="flex justify-between"><dt className="text-muted-foreground">Slug</dt><dd>{school.slug}</dd></div>
          <div className="flex justify-between"><dt className="text-muted-foreground">Mascot</dt><dd>{school.mascot || "—"}</dd></div>
          <div className="flex justify-between"><dt className="text-muted-foreground">Location</dt><dd>{[school.city, school.state].filter(Boolean).join(", ") || "—"}</dd></div>
        </dl>
      </div> : (
        <EmptyState
          title="School record not found"
          description="Run supabase/setup.sql or supabase/fix-current-db.sql."
        />
      )}
    </div>
  );
}
