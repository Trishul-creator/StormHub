import { redirect } from "next/navigation";
import Link from "next/link";
import { PageHeader } from "@/components/layout/page-header";
import { requireAdmin } from "@/lib/auth";

export default async function AdminContentPage() {
  await requireAdmin();

  return (
    <div className="container mx-auto px-4 py-8">
      <PageHeader title="Content Moderation" description="Review and moderate all platform content." />
      <p className="text-muted-foreground mb-4">
        Use the <Link href="/manage/approvals" className="text-storm-electric hover:underline">approval queue</Link> to review pending content.
      </p>
    </div>
  );
}
