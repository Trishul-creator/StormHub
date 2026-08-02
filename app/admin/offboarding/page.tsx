import Link from "next/link";
import { redirect } from "next/navigation";
import { ArchiveX } from "lucide-react";
import {
  TenantOffboardingWorkflow,
  type ReviewStatus,
  type TenantOffboardingRequestView,
  type TenantOffboardingScopeOption,
} from "@/components/admin/tenant-offboarding-workflow";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { requireAdmin } from "@/lib/auth";
import { getAllDistricts } from "@/lib/districts";
import { getAdminScopeSchools, getAllSchools } from "@/lib/schools";
import { createClient } from "@/lib/supabase/server";
import type {
  TenantOffboardingScope,
  TenantOffboardingStatus,
  UserRole,
} from "@/types/database";

type SchoolRow = {
  id: string;
  district_id: string | null;
  name: string;
};

type DistrictRow = {
  id: string;
  name: string;
};

type RequestRow = {
  id: string;
  scope_type: TenantOffboardingScope;
  school_id: string | null;
  district_id: string | null;
  requested_by: string | null;
  request_reason: string;
  status: TenantOffboardingStatus;
  requested_at: string;
  reviewer_notes: string | null;
  export_reference: string | null;
  scheduled_purge_at: string | null;
  completion_reference: string | null;
  requester: {
    full_name: string | null;
    email: string | null;
  } | null;
};

const terminalStatuses: TenantOffboardingStatus[] = ["completed", "rejected", "cancelled"];
const activeStatuses: TenantOffboardingStatus[] = [
  "requested",
  "under_review",
  "export_ready",
  "approved",
  "scheduled",
];
const historyPageSize = 50;
const requestSelect = `
  id,
  scope_type,
  school_id,
  district_id,
  requested_by,
  request_reason,
  status,
  requested_at,
  reviewer_notes,
  export_reference,
  scheduled_purge_at,
  completion_reference,
  requester:profiles!requested_by(full_name,email)
`;

function allowedTransitions(
  role: UserRole,
  actorUserId: string,
  request: RequestRow
): ReviewStatus[] {
  if (
    terminalStatuses.includes(request.status)
    || (request.requested_by === actorUserId && role !== "super_admin")
  ) return [];

  if (role === "super_admin") {
    if (request.status === "requested") return ["under_review", "rejected"];
    if (request.status === "under_review") return ["export_ready", "rejected"];
    if (request.status === "export_ready") return ["approved", "rejected"];
    if (request.status === "approved") return ["scheduled"];
    if (request.status === "scheduled") return ["completed"];
    return [];
  }

  if (role !== "district_admin" || request.scope_type !== "school") return [];
  if (request.status === "requested") return ["under_review", "rejected"];
  if (request.status === "under_review") return ["export_ready", "rejected"];
  if (request.status === "export_ready") return ["rejected"];
  return [];
}

function canCancelRequest(
  role: UserRole,
  actorUserId: string,
  request: RequestRow
): boolean {
  if (terminalStatuses.includes(request.status)) return false;
  if (role === "super_admin") return true;
  return request.requested_by === actorUserId
    && ["requested", "under_review", "export_ready"].includes(request.status);
}

export default async function TenantOffboardingPage({
  searchParams,
}: {
  searchParams: Promise<{ historyPage?: string }>;
}) {
  const { profile } = await requireAdmin();
  const supabase = await createClient();
  const params = await searchParams;
  const requestedHistoryPage = /^\d+$/.test(params.historyPage ?? "")
    ? Math.max(1, Number(params.historyPage))
    : 1;

  const [districtRows, allSchoolRows] = await Promise.all([
    getAllDistricts(),
    getAllSchools(),
  ]);
  const districts = districtRows as DistrictRow[];
  const schools = getAdminScopeSchools(allSchoolRows, profile) as SchoolRow[];
  const activeRequests: RequestRow[] = [];
  let terminalRequests: RequestRow[] = [];
  let terminalCount = 0;
  let requestError: { code?: string; message: string } | null = null;

  if (!supabase) {
    requestError = { code: "PGRST205", message: "Database client unavailable" };
  } else {
    for (let offset = 0; ; offset += 250) {
      const result = await supabase
        .from("tenant_offboarding_requests")
        .select(requestSelect)
        .in("status", activeStatuses)
        .order("requested_at", { ascending: false })
        .range(offset, offset + 249);
      if (result.error) {
        requestError = result.error;
        break;
      }
      const batch = (result.data ?? []) as unknown as RequestRow[];
      activeRequests.push(...batch);
      if (batch.length < 250) break;
    }

    if (!requestError) {
      const historyOffset = (requestedHistoryPage - 1) * historyPageSize;
      const result = await supabase
        .from("tenant_offboarding_requests")
        .select(requestSelect, { count: "exact" })
        .in("status", terminalStatuses)
        .order("requested_at", { ascending: false })
        .range(historyOffset, historyOffset + historyPageSize - 1);
      if (result.error) {
        requestError = result.error;
      } else {
        terminalRequests = (result.data ?? []) as unknown as RequestRow[];
        terminalCount = result.count ?? 0;
      }
    }
  }

  const historyPages = Math.max(1, Math.ceil(terminalCount / historyPageSize));
  if (terminalCount > 0 && requestedHistoryPage > historyPages) {
    redirect(`/admin/offboarding?historyPage=${historyPages}`);
  }
  const historyPage = Math.min(requestedHistoryPage, historyPages);
  const requests = [...activeRequests, ...terminalRequests];
  const schemaAvailable = !requestError
    || !(
      requestError.code === "42P01"
      || requestError.code === "PGRST205"
      || requestError.message.includes("tenant_offboarding_requests")
    );

  const districtNames = new Map(districts.map((district) => [district.id, district.name]));
  const schoolNames = new Map(schools.map((school) => [school.id, school.name]));
  const scopeOptions: TenantOffboardingScopeOption[] = [];

  if (profile.role === "super_admin" || profile.role === "district_admin") {
    for (const district of districts) {
      scopeOptions.push({
        scopeType: "district",
        scopeId: district.id,
        label: `District · ${district.name}`,
      });
    }
  }
  for (const school of schools) {
    scopeOptions.push({
      scopeType: "school",
      scopeId: school.id,
      label: `School · ${school.name}`,
    });
  }

  const requestViews: TenantOffboardingRequestView[] = requests.map((request) => ({
    id: request.id,
    scopeType: request.scope_type,
    scopeLabel: request.scope_type === "school"
      ? `School · ${schoolNames.get(request.school_id ?? "") ?? "Former school tenant"}`
      : `District · ${districtNames.get(request.district_id ?? "") ?? "Former district tenant"}`,
    status: request.status,
    requestReason: request.request_reason,
    requestedAt: request.requested_at,
    requestedByLabel:
      request.requester?.full_name
      || request.requester?.email
      || (request.requested_by ? "Administrator identity restricted" : "Former administrator"),
    requestedByUserId: request.requested_by,
    reviewerNotes: request.reviewer_notes,
    exportReference: request.export_reference,
    scheduledPurgeAt: request.scheduled_purge_at,
    completionReference: request.completion_reference,
    allowedTransitions: allowedTransitions(profile.role, profile.id, request),
    canCancel: canCancelRequest(profile.role, profile.id, request),
  }));

  return (
    <main className="container mx-auto px-4 py-8">
      <PageHeader
        title="Tenant offboarding"
        description="Record, review, and safely recover school or district deletion workflows."
      >
        <div className="flex items-center gap-2 rounded-full border bg-card px-3 py-1.5 text-xs text-muted-foreground">
          <ArchiveX className="h-3.5 w-3.5" />
          No one-click hard delete
        </div>
      </PageHeader>

      {requestError && schemaAvailable && (
        <div className="mb-6 rounded-xl border border-red-300 bg-red-50 p-4 text-sm text-red-950 dark:border-red-800 dark:bg-red-950/40 dark:text-red-100">
          The scoped request history could not be loaded. No offboarding action was performed.
        </div>
      )}

      <TenantOffboardingWorkflow
        scopeOptions={scopeOptions}
        requests={requestViews}
        schemaAvailable={schemaAvailable}
      />
      {terminalCount > historyPageSize && (
        <nav
          className="mt-6 flex items-center justify-between gap-3"
          aria-label="Offboarding history pages"
        >
          {historyPage > 1 ? (
            <Button variant="outline" asChild>
              <Link href={`/admin/offboarding?historyPage=${historyPage - 1}`}>
                Newer history
              </Link>
            </Button>
          ) : <span />}
          <span className="text-sm text-muted-foreground">
            Completed history page {historyPage} of {historyPages}
          </span>
          {historyPage < historyPages ? (
            <Button variant="outline" asChild>
              <Link href={`/admin/offboarding?historyPage=${historyPage + 1}`}>
                Older history
              </Link>
            </Button>
          ) : <span />}
        </nav>
      )}
    </main>
  );
}
