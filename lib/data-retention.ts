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
  | "platform_support_access_log"
  | "account_deletion_executions"
  | "coursework_upload_intents"
  | "coursework_upload_objects"
  | "data_retention_runs";

export type RetentionCounts = Record<RetentionCountKey, number>;

function cutoff(days: number, now: number): string {
  return new Date(now - days * 24 * 60 * 60 * 1000).toISOString();
}

export async function runDataRetention(): Promise<RetentionCounts> {
  const admin = createAdminClient();
  if (!admin) throw new Error("Supabase service role is not configured.");
  const retentionAdmin = admin;
  const now = Date.now();
  const { data: runId, error: runError } = await retentionAdmin.rpc("begin_data_retention_run");
  if (runError) {
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
    platform_support_access_log: 0,
    account_deletion_executions: 0,
    coursework_upload_intents: 0,
    coursework_upload_objects: 0,
    data_retention_runs: 0,
  } satisfies RetentionCounts;
  if (!runId) {
    // Another healthy worker owns the lease. This invocation is successful but
    // intentionally does no duplicate deletion work.
    return counts;
  }

  async function remove(
    key: RetentionCountKey,
    column: string,
    before: string,
    configure?: (query: any) => any
  ) {
    if (key !== "coursework_upload_intents") {
      while (true) {
        const { data, error } = await retentionAdmin.rpc("delete_retention_batch", {
          target_table: key,
          target_before: before,
          target_exclude_id: key === "data_retention_runs" ? runId : null,
          target_limit: 500,
        });
        if (error) throw new Error(`${key}: ${error.message}`);
        const deleted = Number(data ?? 0);
        if (!Number.isFinite(deleted) || deleted < 0) {
          throw new Error(`${key}: retention RPC returned an invalid count`);
        }
        counts[key] += deleted;
        if (deleted < 500) break;
      }
      return;
    }

    let query = retentionAdmin.from(key).delete().lt(column, before);
    if (configure) query = configure(query);
    const { data, error } = await query.select("id");
    if (error) throw new Error(`${key}: ${error.message}`);
    counts[key] += Array.isArray(data) ? data.length : 0;
  }

  async function removeCourseworkUploadObjects(
    intents: Array<{ id: string; storage_path: string }>
  ) {
    for (let index = 0; index < intents.length; index += 100) {
      const paths = intents
        .slice(index, index + 100)
        .map((intent) => intent.storage_path);
      const { data, error } = await retentionAdmin.storage
        .from("coursework-private")
        .remove(paths);
      if (error) throw new Error(`coursework_upload_objects: ${error.message}`);
      counts.coursework_upload_objects += Array.isArray(data) ? data.length : 0;
    }
  }

  async function cleanExpiredCourseworkUploadObjects() {
    const cleanupTimestamp = new Date(now).toISOString();
    const signedTokenGraceCutoff = new Date(now - 3 * 60 * 60 * 1000).toISOString();

    // Pending rows are repeatedly selected from page one because every
    // successful batch is moved to the terminal "expired" state.
    while (true) {
      const { data, error } = await retentionAdmin
        .from("coursework_upload_intents")
        .select("id,storage_path")
        .eq("status", "pending")
        .lt("expires_at", new Date(now).toISOString())
        .order("id", { ascending: true })
        .limit(500);
      if (error) throw new Error(`coursework_upload_intents: ${error.message}`);
      const pending = (data ?? []) as Array<{ id: string; storage_path: string }>;
      if (!pending.length) break;

      const { error: updateError } = await retentionAdmin
        .from("coursework_upload_intents")
        .update({
          status: "expired",
          rejection_reason: "Registration window expired",
        })
        .in("id", pending.map((intent) => intent.id))
        .eq("status", "pending");
      if (updateError) throw new Error(`coursework_upload_intents: ${updateError.message}`);
      if (pending.length < 500) break;
    }

    // Keep terminal rows for seven days and retry object removal on every run.
    // A signed upload token used after an earlier cleanup therefore cannot
    // leave a permanent orphan before the tracking row is retired.
    let offset = 0;
    while (true) {
      const { data, error } = await retentionAdmin
        .from("coursework_upload_intents")
        .select("id,storage_path")
        .in("status", ["rejected", "expired"])
        .lt("expires_at", signedTokenGraceCutoff)
        .order("id", { ascending: true })
        .range(offset, offset + 499);
      if (error) throw new Error(`coursework_upload_intents: ${error.message}`);
      const terminal = (data ?? []) as Array<{ id: string; storage_path: string }>;
      if (!terminal.length) break;

      await removeCourseworkUploadObjects(terminal);
      const { error: updateError } = await retentionAdmin
        .from("coursework_upload_intents")
        .update({ object_removed_at: cleanupTimestamp })
        .in("id", terminal.map((intent) => intent.id))
        .in("status", ["rejected", "expired"]);
      if (updateError) throw new Error(`coursework_upload_intents: ${updateError.message}`);
      offset += terminal.length;
      if (terminal.length < 500) break;
    }
  }

  try {
    const { data: hasActiveHold, error: holdError } = await retentionAdmin.rpc(
      "has_any_active_legal_hold"
    );
    if (holdError) {
      // Fail closed: an unavailable hold registry must never result in deletion.
      throw new Error(`legal_holds: ${holdError.message}`);
    }
    if (hasActiveHold === true) {
      const { error: skippedError } = await retentionAdmin
        .from("data_retention_runs")
        .update({
          status: "completed",
          completed_at: new Date(now).toISOString(),
          deleted_counts: counts,
          error_message: null,
          skipped_reason: "Automatic retention paused by an active legal hold.",
        })
        .eq("id", runId);
      if (skippedError) throw new Error(skippedError.message);
      return counts;
    }

    await cleanExpiredCourseworkUploadObjects();
    await remove(
      "coursework_upload_intents",
      "expires_at",
      cutoff(7, now),
      (query) => query
        .in("status", ["rejected", "expired"])
        .not("object_removed_at", "is", null)
    );
    await remove(
      "coursework_upload_intents",
      "registered_at",
      cutoff(30, now),
      (query) => query.eq("status", "registered")
    );
    await remove("signup_attempts", "created_at", cutoff(RETENTION_DAYS.signupAttempts, now));
    await remove("request_attempts", "created_at", cutoff(RETENTION_DAYS.requestAttempts, now));
    await remove("digest_deliveries", "created_at", cutoff(RETENTION_DAYS.digestDeliveries, now));
    await remove("email_outbox", "created_at", cutoff(RETENTION_DAYS.emailOutbox, now));
    await remove("notifications", "created_at", cutoff(RETENTION_DAYS.notifications, now));
    await remove(
      "feedback",
      "resolved_at",
      cutoff(RETENTION_DAYS.resolvedSupport, now),
      (query) => query.eq("status", "resolved")
    );
    await remove(
      "account_deletion_requests",
      "reviewed_at",
      cutoff(RETENTION_DAYS.reviewedDeletionRequests, now),
      (query) => query.in("status", ["completed", "rejected"])
    );
    await remove("analytics_events", "created_at", cutoff(RETENTION_DAYS.analyticsEvents, now));
    await remove("admin_audit_log", "occurred_at", cutoff(RETENTION_DAYS.adminAudit, now));
    await remove(
      "platform_support_sessions",
      "started_at",
      cutoff(RETENTION_DAYS.platformSupportSessions, now)
    );
    await remove(
      "platform_support_access_log",
      "occurred_at",
      cutoff(RETENTION_DAYS.platformSupportAccessLog, now)
    );
    await remove(
      "account_deletion_executions",
      "updated_at",
      cutoff(RETENTION_DAYS.accountDeletionExecutions, now)
    );
    await remove(
      "data_retention_runs",
      "started_at",
      cutoff(RETENTION_DAYS.retentionRunHistory, now),
      (query) => query.neq("id", runId)
    );

    const { error: completeError } = await retentionAdmin
      .from("data_retention_runs")
      .update({
        status: "completed",
        completed_at: new Date(now).toISOString(),
        deleted_counts: counts,
        error_message: null,
        skipped_reason: null,
      })
      .eq("id", runId);
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
        skipped_reason: null,
      })
      .eq("id", runId);
    throw error;
  }
}
