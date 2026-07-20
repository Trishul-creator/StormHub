import { DeletionRequestReview } from "@/components/admin/deletion-request-review";
import { PageHeader } from "@/components/layout/page-header";
import { StatusBadge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { requireAdmin } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

type DeletionRequestRow = {
  id: string;
  status: string;
  reason: string | null;
  requested_at: string;
  reviewer_notes: string | null;
  profiles: { full_name: string | null; email: string | null; role: string } | null;
};

export default async function DeletionRequestsPage() {
  await requireAdmin();
  const supabase = await createClient();
  const { data, error } = supabase
    ? await supabase
        .from("account_deletion_requests")
        .select("id,status,reason,requested_at,reviewer_notes,profiles:user_id(full_name,email,role)")
        .order("requested_at", { ascending: false })
        .limit(100)
    : { data: [], error: null };
  const requests = (data ?? []) as unknown as DeletionRequestRow[];

  return (
    <div className="container mx-auto px-4 py-8">
      <PageHeader
        title="Account Deletion Requests"
        description="Review requests within the district retention and identity-verification process."
      />
      {error && <p className="mb-4 text-sm text-destructive">Could not load deletion requests.</p>}
      <div className="space-y-4">
        {requests.map((request) => (
          <Card key={request.id}>
            <CardHeader className="space-y-2">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <CardTitle className="text-base">{request.profiles?.full_name || request.profiles?.email || "Deleted account"}</CardTitle>
                <StatusBadge status={request.status} />
              </div>
              <p className="text-sm text-muted-foreground">
                {request.profiles?.email || "Email removed"} · Requested {new Date(request.requested_at).toLocaleString()}
              </p>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <p className="text-sm font-medium">User reason</p>
                <p className="mt-1 whitespace-pre-wrap text-sm text-muted-foreground">{request.reason || "No reason provided."}</p>
              </div>
              {request.status === "pending" ? (
                <DeletionRequestReview requestId={request.id} />
              ) : request.reviewer_notes ? (
                <div>
                  <p className="text-sm font-medium">Review notes</p>
                  <p className="mt-1 whitespace-pre-wrap text-sm text-muted-foreground">{request.reviewer_notes}</p>
                </div>
              ) : null}
            </CardContent>
          </Card>
        ))}
      </div>
      {!error && requests.length === 0 && (
        <div className="rounded-lg border border-dashed p-8 text-center">
          <p className="font-medium">No account deletion requests</p>
          <p className="mt-1 text-sm text-muted-foreground">New requests submitted from Settings will appear here.</p>
        </div>
      )}
    </div>
  );
}
