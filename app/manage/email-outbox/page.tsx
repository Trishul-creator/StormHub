import { PageHeader } from "@/components/layout/page-header";
import { StatusBadge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { retryEmailOutbox } from "@/lib/actions";
import { requireAdmin } from "@/lib/auth";
import { getEmailOutbox } from "@/lib/notifications";
import { formatDateTime } from "@/lib/utils";

export default async function EmailOutboxPage() {
  await requireAdmin();
  const items = await getEmailOutbox();
  async function retryOutboxAction() {
    "use server";
    await retryEmailOutbox();
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <PageHeader
        title="Email Outbox"
        description="Delivery log for notification emails. Configure Resend to send real email, then retry pending or failed messages here."
      />
      <form action={retryOutboxAction} className="mb-5 rounded-xl border bg-white p-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="font-semibold text-storm-navy">Send queued emails</p>
            <p className="text-sm text-muted-foreground">
              Processes up to 50 pending or failed messages using the configured email provider.
            </p>
          </div>
          <Button type="submit">Retry pending/failed</Button>
        </div>
      </form>
      <div className="mb-5 grid gap-3 sm:grid-cols-3">
        {["pending", "sent", "failed"].map((status) => (
          <div key={status} className="rounded-xl border bg-white p-4">
            <p className="text-2xl font-bold text-storm-navy">{items.filter((item) => item.status === status).length}</p>
            <p className="text-sm capitalize text-muted-foreground">{status}</p>
          </div>
        ))}
      </div>
      <div className="overflow-x-auto rounded-xl border bg-white">
        <table className="w-full text-left text-sm">
          <thead className="border-b bg-storm-light/30 text-xs uppercase text-muted-foreground">
            <tr>
              <th className="p-3">Recipient</th>
              <th className="p-3">Subject</th>
              <th className="p-3">Type</th>
              <th className="p-3">Status</th>
              <th className="p-3">Created</th>
              <th className="p-3">Error</th>
            </tr>
          </thead>
          <tbody>
            {items.map((item) => (
              <tr key={item.id} className="border-b last:border-0">
                <td className="p-3">{item.recipient_email}</td>
                <td className="p-3 font-medium text-storm-navy">{item.subject}</td>
                <td className="p-3">{item.type.replaceAll("_", " ")}</td>
                <td className="p-3"><StatusBadge status={item.status} /></td>
                <td className="p-3 text-muted-foreground">{formatDateTime(item.created_at)}</td>
                <td className="max-w-xs p-3 text-xs text-red-700">{item.error_message}</td>
              </tr>
            ))}
            {items.length === 0 && (
              <tr><td colSpan={6} className="p-10 text-center text-muted-foreground">No email messages have been queued.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
