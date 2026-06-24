import { MessageSquare } from "lucide-react";
import { FeedbackStatusActions } from "@/components/admin/feedback-status-actions";
import { PageHeader } from "@/components/layout/page-header";
import { StatusBadge } from "@/components/ui/badge";
import { requireAdmin } from "@/lib/auth";
import { getFeedbackItems } from "@/lib/data";
import { formatDateTime } from "@/lib/utils";

export default async function AdminFeedbackPage() {
  await requireAdmin();
  const items = await getFeedbackItems();
  const openCount = items.filter((item) => item.status === "open").length;
  const reviewedCount = items.filter((item) => item.status === "reviewed").length;
  const resolvedCount = items.filter((item) => item.status === "resolved").length;

  return (
    <div className="container mx-auto px-4 py-8">
      <PageHeader
        title="Feedback Inbox"
        description="Review support messages and contact form submissions."
      />

      <div className="mb-5 grid gap-3 sm:grid-cols-3">
        <div className="rounded-xl border bg-white p-4">
          <p className="text-2xl font-bold text-storm-navy">{openCount}</p>
          <p className="text-sm text-muted-foreground">Open</p>
        </div>
        <div className="rounded-xl border bg-white p-4">
          <p className="text-2xl font-bold text-storm-navy">{reviewedCount}</p>
          <p className="text-sm text-muted-foreground">Reviewed</p>
        </div>
        <div className="rounded-xl border bg-white p-4">
          <p className="text-2xl font-bold text-storm-navy">{resolvedCount}</p>
          <p className="text-sm text-muted-foreground">Resolved</p>
        </div>
      </div>

      <div className="space-y-4">
        {items.map((item) => (
          <article key={item.id} className="rounded-xl border bg-white p-5 shadow-sm">
            <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
              <div className="min-w-0 space-y-2">
                <div className="flex flex-wrap items-center gap-2">
                  <MessageSquare className="h-4 w-4 text-storm-electric" />
                  <h2 className="font-semibold text-storm-navy">
                    {item.category ? item.category.replace(/_/g, " ") : "Feedback"}
                  </h2>
                  <StatusBadge status={item.status} />
                </div>
                <p className="whitespace-pre-wrap text-sm leading-6 text-storm-navy">{item.message}</p>
                <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
                  <span>From: {item.name || item.profile?.full_name || "Anonymous"}</span>
                  <span>Email: {item.email || item.profile?.email || "Not provided"}</span>
                  {item.profile?.role && <span>Role: {item.profile.role}</span>}
                  {item.created_at && <span>Sent: {formatDateTime(item.created_at)}</span>}
                </div>
              </div>
              <FeedbackStatusActions id={item.id} status={item.status} />
            </div>
          </article>
        ))}
      </div>

      {items.length === 0 && (
        <div className="rounded-xl border border-dashed bg-white p-12 text-center text-muted-foreground">
          No contact messages have been submitted yet.
        </div>
      )}
    </div>
  );
}
