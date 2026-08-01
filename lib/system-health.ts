import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";
import { getEmailConfirmationStatus } from "@/lib/supabase/auth-health";
import {
  getEmailConfigurationStatus,
  getRetentionFreshness,
  isEmailDeliveryReady,
} from "@/lib/operational-health";

type RetentionRun = {
  status?: "running" | "completed" | "failed";
  started_at?: string | null;
  completed_at?: string | null;
};

const HEALTH_PROBE_TTL_MS = 30_000;

async function checkDatabase(
  admin: NonNullable<ReturnType<typeof createAdminClient>>,
) {
  const { error } = await admin
    .from("schools")
    .select("id", { head: true, count: "exact" })
    .limit(1);
  return error ? "unavailable" as const : "ok" as const;
}

async function checkPrivateStorage(
  admin: NonNullable<ReturnType<typeof createAdminClient>>,
) {
  try {
    const { data, error } = await admin.storage.getBucket("coursework-private");
    return !error && data?.public === false ? "ok" as const : "unavailable" as const;
  } catch {
    return "unavailable" as const;
  }
}

async function checkRetention(
  admin: NonNullable<ReturnType<typeof createAdminClient>>,
) {
  try {
    const { data, error } = await admin
      .from("data_retention_runs")
      .select("status,started_at,completed_at")
      .order("started_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    return error
      ? { status: "missing" as const, lastCompletedAt: null }
      : getRetentionFreshness(data as RetentionRun | null);
  } catch {
    return { status: "missing" as const, lastCompletedAt: null };
  }
}

async function collectSystemHealthSnapshot() {
  const probeStartedAt = Date.now();
  const admin = createAdminClient();
  const emailDelivery = getEmailConfigurationStatus();
  const emailDeliveryReady = isEmailDeliveryReady(emailDelivery);
  const cronAuthentication = process.env.CRON_SECRET?.trim()
    ? "configured" as const
    : "missing" as const;
  const [emailConfirmation, database, storage, dataRetention] = await Promise.all([
    getEmailConfirmationStatus(),
    admin ? checkDatabase(admin) : Promise.resolve("unavailable" as const),
    admin ? checkPrivateStorage(admin) : Promise.resolve("unavailable" as const),
    admin
      ? checkRetention(admin)
      : Promise.resolve({ status: "missing" as const, lastCompletedAt: null }),
  ]);

  const healthy = database === "ok"
    && storage === "ok"
    && emailConfirmation === "required"
    && emailDeliveryReady
    && cronAuthentication === "configured"
    && (dataRetention.status === "fresh" || dataRetention.status === "running");

  return {
    healthy,
    database,
    storage,
    emailConfirmation,
    emailDelivery,
    emailDeliveryReady,
    cronAuthentication,
    dataRetention,
    checkedAt: new Date().toISOString(),
    probeDurationMs: Date.now() - probeStartedAt,
  };
}

export type SystemHealthSnapshot = Awaited<ReturnType<typeof collectSystemHealthSnapshot>>;

let cachedHealth:
  | { snapshot: SystemHealthSnapshot; expiresAt: number }
  | null = null;
let inFlightHealthProbe: Promise<SystemHealthSnapshot> | null = null;

export async function getSystemHealthSnapshot(
  options: { forceRefresh?: boolean; now?: number } = {},
): Promise<SystemHealthSnapshot> {
  const now = options.now ?? Date.now();
  if (!options.forceRefresh && cachedHealth && cachedHealth.expiresAt > now) {
    return cachedHealth.snapshot;
  }
  if (inFlightHealthProbe) return inFlightHealthProbe;

  inFlightHealthProbe = collectSystemHealthSnapshot()
    .then((snapshot) => {
      cachedHealth = {
        snapshot,
        expiresAt: Date.now() + HEALTH_PROBE_TTL_MS,
      };
      return snapshot;
    })
    .finally(() => {
      inFlightHealthProbe = null;
    });
  return inFlightHealthProbe;
}
