import Link from "next/link";
import { redirect } from "next/navigation";
import { Inbox, Mail, Send } from "lucide-react";
import { FeedbackStatusActions } from "@/components/admin/feedback-status-actions";
import { EmptyState } from "@/components/layout/empty-state";
import { PageHeader } from "@/components/layout/page-header";
import { Badge, StatusBadge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { requireAuth } from "@/lib/auth";
import { getFeedbackItems } from "@/lib/data";
import { SUPPORT_EMAIL } from "@/lib/schools";
import { formatDateTime, humanizeLabel } from "@/lib/utils";
import type { FeedbackStatus } from "@/types/database";

interface SupportInboxPageProps {
  searchParams: Promise<{ status?: string }>;
}

const statuses: Array<{ label: string; value?: FeedbackStatus }> = [
  { label: "All" },
  { label: "Open", value: "open" },
  { label: "Reviewed", value: "reviewed" },
  { label: "Resolved", value: "resolved" },
];

export default async function SupportInboxPage({ searchParams }: SupportInboxPageProps) {
  const { profile } = await requireAuth("/admin/feedback");
  if (profile.role !== "super_admin") redirect("/admin?error=super_admin_required");

  const params = await searchParams;
  const selectedStatus = statuses.find((item) => item.value === params.status)?.value;
  const items = await getFeedbackItems();
  const visibleItems = selectedStatus ? items.filter((item) => item.status === selectedStatus) : items;

  return (
    <div className="container mx-auto px-4 py-8">
      <PageHeader
        title="Support inbox"
        description={`Messages submitted through StormHub are saved here and mirrored to ${SUPPORT_EMAIL}.`}
      >
        <Button variant="outline" asChild>
          <a href={`mailto:${SUPPORT_EMAIL}`}><Mail className="h-4 w-4" /> Open support email</a>
        </Button>
        <Button variant="outline" asChild>
          <Link href="/manage/email-outbox"><Send className="h-4 w-4" /> Email delivery</Link>
        </Button>
      </PageHeader>

      <div className="mb-6 flex flex-wrap gap-2" aria-label="Filter support messages">
        {statuses.map((item) => {
          const active = item.value === selectedStatus || (!item.value && !selectedStatus);
          return (
            <Button key={item.label} size="sm" variant={active ? "default" : "outline"} asChild>
              <Link href={item.value ? `?status=${item.value}` : "/admin/feedback"}>{item.label}</Link>
            </Button>
          );
        })}
      </div>

      {visibleItems.length === 0 ? (
        <EmptyState
          title={selectedStatus ? `No ${selectedStatus} messages` : "No support messages"}
          description="New contact-form submissions will appear here while also being sent to the configured support email."
          actionLabel={selectedStatus ? "View all messages" : undefined}
          actionHref={selectedStatus ? "/admin/feedback" : undefined}
        />
      ) : (
        <div className="space-y-4">
          {visibleItems.map((item) => {
            const replyEmail = item.email || item.profile?.email || null;
            return (
              <Card key={item.id}>
                <CardHeader className="gap-3 md:flex-row md:items-start md:justify-between md:space-y-0">
                  <div className="min-w-0 space-y-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <Inbox className="h-4 w-4 text-storm-electric" aria-hidden="true" />
                      <StatusBadge status={item.status} />
                      <Badge variant="secondary">{humanizeLabel(item.category || "support")}</Badge>
                    </div>
                    <p className="font-semibold text-storm-navy">
                      {item.name || item.profile?.full_name || "Anonymous sender"}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {item.school?.name || "School not available"} · {formatDateTime(item.created_at)}
                    </p>
                    {replyEmail && (
                      <a href={`mailto:${replyEmail}`} className="block break-all text-sm text-storm-electric hover:underline">
                        {replyEmail}
                      </a>
                    )}
                  </div>
                  <FeedbackStatusActions id={item.id} status={item.status} canReply={Boolean(replyEmail)} />
                </CardHeader>
                <CardContent>
                  <p className="whitespace-pre-wrap text-sm leading-6 text-storm-navy/85">{item.message}</p>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
