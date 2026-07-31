import Link from "next/link";
import { notFound } from "next/navigation";
import { Building2, Clock3, Eye, Inbox, LockKeyhole } from "lucide-react";
import { FeedbackStatusActions } from "@/components/admin/feedback-status-actions";
import { PlatformSupportExpiryGuard } from "@/components/admin/platform-support-expiry-guard";
import { SupportSchoolSelector } from "@/components/admin/support-school-selector";
import { EmptyState } from "@/components/layout/empty-state";
import { PageHeader } from "@/components/layout/page-header";
import { Badge, StatusBadge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { requireAdmin } from "@/lib/auth";
import { getFeedbackItems } from "@/lib/data";
import {
  getAllSchools,
  getAdminScopeSchools,
  getSchoolForProfile,
} from "@/lib/schools";
import {
  getActivePlatformSupportSession,
  recordPlatformSupportAccess,
} from "@/lib/support-access";
import { formatDateTime, humanizeLabel } from "@/lib/utils";
import type { FeedbackStatus, School } from "@/types/database";

interface SupportInboxPageProps {
  searchParams: Promise<{ status?: string; school?: string }>;
}

const statuses: Array<{ label: string; value?: FeedbackStatus }> = [
  { label: "All" },
  { label: "Open", value: "open" },
  { label: "Reviewed", value: "reviewed" },
  { label: "Resolved", value: "resolved" },
];

export default async function SupportInboxPage({ searchParams }: SupportInboxPageProps) {
  const { profile } = await requireAdmin();
  const params = await searchParams;
  const selectedStatus = statuses.find((item) => item.value === params.status)?.value;
  const requestedSchoolSlug = params.school?.trim() || null;
  const canChooseSchool = profile.role === "district_admin" || profile.role === "super_admin";

  const schools = canChooseSchool
    ? getAdminScopeSchools(await getAllSchools(), profile)
    : [];
  const selectedSchool = canChooseSchool
    ? requestedSchoolSlug
      ? schools.find((school) => school.slug === requestedSchoolSlug) ?? null
      : null
    : await getSchoolForProfile(profile);

  if (requestedSchoolSlug && !selectedSchool) notFound();

  const supportSession = profile.role === "super_admin" && selectedSchool
    ? await getActivePlatformSupportSession(profile, selectedSchool.id)
    : null;

  let supportAccessRecorded = false;
  if (profile.role === "super_admin" && selectedSchool && supportSession) {
    supportAccessRecorded = await recordPlatformSupportAccess({
      actor: profile,
      schoolId: selectedSchool.id,
      action: "view",
      resourceType: "support_feedback_inbox",
    });
  }

  const canReadMessages = Boolean(
    selectedSchool
    && (
      profile.role !== "super_admin"
      || (supportSession && supportAccessRecorded)
    )
  );
  const items = canReadMessages && selectedSchool
    ? await getFeedbackItems(selectedSchool.id)
    : [];
  const visibleItems = selectedStatus
    ? items.filter((item) => item.status === selectedStatus)
    : items;

  return (
    <div className="container mx-auto px-4 py-8">
      <PageHeader
        title="Support inbox"
        description="Review support requests inside the school scope where they were submitted. External email receives only a generic new-request alert."
      />

      <SupportScope
        profileRole={profile.role}
        schools={schools}
        selectedSchool={selectedSchool}
      />

      {!selectedSchool ? (
        <Card className="border-blue-200 dark:border-blue-900">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Building2 className="h-5 w-5 text-storm-electric" />
              Choose one school
            </CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">
            Message content is never combined into a platform-wide inbox. Choose the school whose
            request you are authorized to review.
          </CardContent>
        </Card>
      ) : profile.role === "super_admin" && !supportSession ? (
        <Card className="border-amber-300 dark:border-amber-800">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <LockKeyhole className="h-5 w-5 text-amber-600 dark:text-amber-300" />
              Read-only support session required
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 text-sm text-muted-foreground">
            <p>
              Platform administrators cannot read school support messages through a global inbox.
              Start a recorded, time-limited session for {selectedSchool.name} to inspect this
              school&apos;s requests in read-only mode.
            </p>
            <Button asChild>
              <Link href={`/admin/schools/${selectedSchool.slug}#support-access`}>
                Open {selectedSchool.name} support controls
              </Link>
            </Button>
          </CardContent>
        </Card>
      ) : profile.role === "super_admin" && !supportAccessRecorded ? (
        <Card className="border-amber-300 dark:border-amber-800">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <LockKeyhole className="h-5 w-5 text-amber-600 dark:text-amber-300" />
              Support messages stayed locked
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 text-sm text-muted-foreground">
            <p>
              The required audit entry could not be recorded, so no message content was loaded.
              Return to this school&apos;s support controls and try again.
            </p>
            <Button asChild>
              <Link href={`/admin/schools/${selectedSchool.slug}#support-access`}>
                Open {selectedSchool.name} support controls
              </Link>
            </Button>
          </CardContent>
        </Card>
      ) : (
        <>
          {profile.role === "super_admin" && supportSession && supportAccessRecorded && (
            <PlatformSupportExpiryGuard
              expiresAt={supportSession.expires_at}
              returnTo={`/admin/feedback?school=${encodeURIComponent(selectedSchool.slug)}`}
            />
          )}
          {profile.role === "super_admin" && supportSession && supportAccessRecorded && (
            <div className="mb-6 flex items-start gap-3 rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-950 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-100">
              <Eye className="mt-0.5 h-4 w-4 shrink-0" />
              <div>
                <p className="font-semibold">Temporary read-only support is active</p>
                <p className="mt-1">
                  This inbox view is recorded for {selectedSchool.name}. Platform support cannot
                  reply, change status, or resolve requests.
                </p>
                <p className="mt-2 flex items-center gap-1.5 text-xs">
                  <Clock3 className="h-3.5 w-3.5" />
                  Ends automatically {new Date(supportSession.expires_at).toLocaleString()}
                </p>
              </div>
            </div>
          )}

          <div className="mb-6 flex flex-wrap gap-2" aria-label="Filter support messages">
            {statuses.map((item) => {
              const active = item.value === selectedStatus || (!item.value && !selectedStatus);
              const query = new URLSearchParams();
              if (canChooseSchool) query.set("school", selectedSchool.slug);
              if (item.value) query.set("status", item.value);
              const href = query.size > 0
                ? `/admin/feedback?${query.toString()}`
                : "/admin/feedback";
              return (
                <Button key={item.label} size="sm" variant={active ? "default" : "outline"} asChild>
                  <Link href={href}>{item.label}</Link>
                </Button>
              );
            })}
          </div>

          {visibleItems.length === 0 ? (
            <EmptyState
              title={selectedStatus ? `No ${selectedStatus} messages` : "No support messages"}
              description={`No matching contact-form submissions are stored for ${selectedSchool.name}.`}
              actionLabel={selectedStatus ? "View all messages" : undefined}
              actionHref={selectedStatus
                ? canChooseSchool
                  ? `/admin/feedback?school=${encodeURIComponent(selectedSchool.slug)}`
                  : "/admin/feedback"
                : undefined}
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
                          {selectedSchool.name} · {formatDateTime(item.created_at)}
                        </p>
                        {replyEmail && profile.role !== "super_admin" && (
                          <a href={`mailto:${replyEmail}`} className="block break-all text-sm text-storm-electric hover:underline">
                            {replyEmail}
                          </a>
                        )}
                        {replyEmail && profile.role === "super_admin" && (
                          <p className="break-all text-sm text-muted-foreground">{replyEmail}</p>
                        )}
                      </div>
                      {profile.role !== "super_admin" && (
                        <FeedbackStatusActions
                          id={item.id}
                          schoolId={selectedSchool.id}
                          status={item.status}
                          canReply={Boolean(replyEmail)}
                        />
                      )}
                    </CardHeader>
                    <CardContent>
                      <p className="whitespace-pre-wrap text-sm leading-6 text-storm-navy/85">{item.message}</p>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </>
      )}
    </div>
  );
}

function SupportScope({
  profileRole,
  schools,
  selectedSchool,
}: {
  profileRole: "student" | "teacher" | "admin" | "district_admin" | "super_admin";
  schools: School[];
  selectedSchool: School | null;
}) {
  if (profileRole === "admin") {
    return (
      <div className="mb-6 flex items-center gap-3 rounded-xl border bg-card p-4">
        <Building2 className="h-5 w-5 text-storm-electric" />
        <div>
          <p className="font-semibold text-storm-navy">{selectedSchool?.name || "Assigned school"}</p>
          <p className="text-sm text-muted-foreground">Support requests are locked to your school.</p>
        </div>
      </div>
    );
  }

  return (
    <SupportSchoolSelector schools={schools} activeSlug={selectedSchool?.slug} />
  );
}
