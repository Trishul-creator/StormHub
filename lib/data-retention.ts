import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";
import { RETENTION_DAYS } from "@/lib/privacy-policy";

type RetentionCountKey =
  | "signup_attempts"
  | "request_attempts"
  | "digest_deliveries"
  | "email_outbox"
  | "notifications"
  | "feedback"
  | "account_deletion_requests"
  | "analytics_events"
  | "admin_audit_log"
  | "platform_support_sessions"
  | "data_retention_runs";

export type RetentionCounts = Record<RetentionCountKey, number>;

function cutoff(days: number): string {
  return new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();
}

export async function runDataRetention(): Promise<RetentionCounts> {
  const admin = createAdminClient();
  if (!admin) throw new Error("Supabase service role is not configured.");
  const retentionAdmin = admin;

  const { data: run, error: runError } = await retentionAdmin
    .from("data_retention_runs")
    .insert({ status: "running" })
    .select("id")
    .single();
  if (runError || !run) {
    throw new Error(runError?.message || "Could not create the retention run.");
  }

  const counts = {
    signup_attempts: 0,
    request_attempts: 0,
    digest_deliveries: 0,
    email_outbox: 0,
    notifications: 0,
    feedback: 0,
    account_deletion_requests: 0,
    analytics_events: 0,
    admin_audit_log: 0,
    platform_support_sessions: 0,
    data_retention_runs: 0,
  } satisfies RetentionCounts;

  async function remove(
    key: RetentionCountKey,
    column: string,
    before: string,
    configure?: (query: any) => any
  ) {
    let query = retentionAdmin.from(key).delete().lt(column, before);
    if (configure) query = configure(query);
    const { data, error } = await query.select("id");
    if (error) throw new Error(`${key}: ${error.message}`);
    counts[key] = Array.isArray(data) ? data.length : 0;
  }

  try {
    await remove("signup_attempts", "created_at", cutoff(RETENTION_DAYS.signupAttempts));
    await remove("request_attempts", "created_at", cutoff(RETENTION_DAYS.requestAttempts));
    await remove("digest_deliveries", "created_at", cutoff(RETENTION_DAYS.digestDeliveries));
    await remove("email_outbox", "created_at", cutoff(RETENTION_DAYS.emailOutbox));
    await remove("notifications", "created_at", cutoff(RETENTION_DAYS.notifications));
    await remove(
      "feedback",
      "resolved_at",
      cutoff(RETENTION_DAYS.resolvedSupport),
      (query) => query.eq("status", "resolved")
    );
    await remove(
      "account_deletion_requests",
      "reviewed_at",
      cutoff(RETENTION_DAYS.reviewedDeletionRequests),
      (query) => query.in("status", ["completed", "rejected"])
    );
    await remove("analytics_events", "created_at", cutoff(RETENTION_DAYS.analyticsEvents));
    await remove("admin_audit_log", "occurred_at", cutoff(RETENTION_DAYS.adminAudit));
    await remove(
      "platform_support_sessions",
      "started_at",
      cutoff(RETENTION_DAYS.platformSupportSessions)
    );
    await remove(
      "data_retention_runs",
      "started_at",
      cutoff(RETENTION_DAYS.retentionRunHistory),
      (query) => query.neq("id", run.id)
    );

    const { error: completeError } = await retentionAdmin
      .from("data_retention_runs")
      .update({
        status: "completed",
        completed_at: new Date().toISOString(),
        deleted_counts: counts,
        error_message: null,
      })
      .eq("id", run.id);
    if (completeError) throw new Error(completeError.message);
    return counts;
  } catch (error) {
    const message = error instanceof Error ? error.message.slice(0, 500) : "Unknown retention failure";
    await retentionAdmin
      .from("data_retention_runs")
      .update({
        status: "failed",
        completed_at: new Date().toISOString(),
        deleted_counts: counts,
        error_message: message,
      })
      .eq("id", run.id);
    throw error;
  }
}
