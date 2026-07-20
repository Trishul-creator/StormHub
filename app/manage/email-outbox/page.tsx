import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft, Mail, RefreshCw } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { EmptyState } from "@/components/layout/empty-state";
import { StatusBadge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { requireAuth } from "@/lib/auth";
import { retryEmailOutbox } from "@/lib/actions";
import { getEmailOutbox } from "@/lib/notifications";
import { formatDateTime, humanizeLabel } from "@/lib/utils";

async function retryQueuedEmail() {
  "use server";
  await retryEmailOutbox();
}

export default async function EmailOutboxPage() {
  const { profile } = await requireAuth("/manage/email-outbox");
  if (profile.role !== "super_admin") redirect("/manage?error=super_admin_required");

  const items = await getEmailOutbox();

  return (
    <div className="container mx-auto px-4 py-8">
      <PageHeader
        title="Email delivery"
        description="Review support notifications, replies, and other email queued by StormHub."
      >
        <Button variant="outline" asChild>
          <Link href="/admin/feedback"><ArrowLeft className="h-4 w-4" /> Support inbox</Link>
        </Button>
        <form action={retryQueuedEmail}>
          <Button type="submit"><RefreshCw className="h-4 w-4" /> Retry pending email</Button>
        </form>
      </PageHeader>

      {items.length === 0 ? (
        <EmptyState
          title="No queued email"
          description="Support messages and notification email will appear here when email delivery is enabled."
          actionLabel="Open support inbox"
          actionHref="/admin/feedback"
        />
      ) : (
        <div className="space-y-4">
          {items.map((item) => (
            <Card key={item.id}>
              <CardHeader className="gap-3 sm:flex-row sm:items-start sm:justify-between sm:space-y-0">
                <div className="min-w-0">
                  <CardTitle className="flex items-center gap-2 text-base">
                    <Mail className="h-4 w-4 text-storm-electric" aria-hidden="true" />
                    {item.subject}
                  </CardTitle>
                  <p className="mt-2 break-all text-sm text-muted-foreground">To: {item.recipient_email}</p>
                </div>
                <StatusBadge status={item.status} />
              </CardHeader>
              <CardContent className="space-y-3">
                <p className="whitespace-pre-wrap text-sm leading-6 text-storm-navy/85">{item.body}</p>
                <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
                  <span>{humanizeLabel(item.type)}</span>
                  <span>Queued {formatDateTime(item.created_at)}</span>
                  {item.sent_at && <span>Sent {formatDateTime(item.sent_at)}</span>}
                </div>
                {item.error_message && <p className="text-sm text-red-700">{item.error_message}</p>}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
