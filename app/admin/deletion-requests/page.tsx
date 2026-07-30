import { DeletionRequestReview } from "@/components/admin/deletion-request-review";
import { PageHeader } from "@/components/layout/page-header";
import { RoleBadge, StatusBadge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { requireAdmin } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

type DeletionRequestRow = {
  id: string;
  target_user_id_snapshot: string | null;
  requester_role: string | null;
  scope_type: "school" | "district" | "platform" | null;
  school_id: string | null;
  district_id: string | null;
  status: string;
  reason: string | null;
  requested_at: string;
  reviewed_by: string | null;
  reviewed_at: string | null;
  reviewer_notes: string | null;
  profiles: { full_name: string | null; email: string | null; role: string } | null;
};

function scopeLabel(
  request: DeletionRequestRow,
  schoolNames: Map<string, string>,
  districtNames: Map<string, string>
): string {
  if (request.scope_type === "platform") return "Platform scope";
  if (request.scope_type === "district") {
    return request.district_id
      ? `${districtNames.get(request.district_id) ?? "District"} scope`
      : "District scope";
  }
  if (request.scope_type === "school") {
    return request.school_id
      ? `${schoolNames.get(request.school_id) ?? "School"} scope`
      : "School scope";
  }
  return "Legacy request";
}

export default async function DeletionRequestsPage() {
  const { profile } = await requireAdmin();
  const supabase = await createClient();
  const { data, error } = supabase
    ? await supabase
        .from("account_deletion_requests")
        .select(
          "id,target_user_id_snapshot,requester_role,scope_type,school_id,district_id,status,reason,requested_at,reviewed_by,reviewed_at,reviewer_notes,profiles:user_id(full_name,email,role)"
        )
        .order("requested_at", { ascending: false })
        .limit(100)
    : { data: [], error: null };
  const requests = (data ?? []) as unknown as DeletionRequestRow[];
  const schoolIds = [...new Set(requests.flatMap((request) => request.school_id ? [request.school_id] : []))];
  const districtIds = [...new Set(requests.flatMap((request) => request.district_id ? [request.district_id] : []))];
  const schoolNames = new Map<string, string>();
  const districtNames = new Map<string, string>();

  if (supabase && schoolIds.length > 0) {
    const { data: schools } = await supabase
      .from("schools")
      .select("id,name")
      .in("id", schoolIds);
    for (const school of schools ?? []) schoolNames.set(school.id, school.name);
  }
  if (supabase && districtIds.length > 0) {
    const { data: districts } = await supabase
      .from("districts")
      .select("id,name")
      .in("id", districtIds);
    for (const district of districts ?? []) districtNames.set(district.id, district.name);
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <PageHeader
        title="Account Deletion Requests"
        description="Review independently authorized requests within your school, district, or platform scope."
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
              <div className="flex flex-wrap items-center gap-2">
                {request.requester_role && <RoleBadge role={request.requester_role} />}
                <span className="text-xs text-muted-foreground">
                  {scopeLabel(request, schoolNames, districtNames)}
                </span>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <p className="text-sm font-medium">User reason</p>
                <p className="mt-1 whitespace-pre-wrap text-sm text-muted-foreground">{request.reason || "No reason provided."}</p>
              </div>
              {request.status === "pending" && request.target_user_id_snapshot !== profile.id ? (
                <DeletionRequestReview requestId={request.id} />
              ) : request.status === "pending" ? (
                <p className="rounded-md border border-dashed p-3 text-sm text-muted-foreground">
                  Awaiting independent review by an authorized administrator.
                </p>
              ) : request.status === "approved" && request.target_user_id_snapshot !== profile.id ? (
                <div className="space-y-3 rounded-md border border-amber-300/60 bg-amber-50 p-3 text-sm text-amber-950 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-100">
                  <p>
                    Approved; completion is pending. An authorized reviewer can safely retry if
                    an external storage or identity-provider step failed.
                  </p>
                  <DeletionRequestReview requestId={request.id} retry />
                </div>
              ) : request.status === "approved" ? (
                <p className="rounded-md border border-amber-300/60 bg-amber-50 p-3 text-sm text-amber-950 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-100">
                  Approved; an independent higher-scope administrator must complete the deletion.
                </p>
              ) : null}
              {request.reviewer_notes ? (
                <div>
                  <p className="text-sm font-medium">Review notes</p>
                  <p className="mt-1 whitespace-pre-wrap text-sm text-muted-foreground">{request.reviewer_notes}</p>
                </div>
              ) : null}
              {request.reviewed_at && (
                <p className="text-xs text-muted-foreground">
                  Reviewed {new Date(request.reviewed_at).toLocaleString()}
                </p>
              )}
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
