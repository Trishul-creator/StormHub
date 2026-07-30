import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { logEvent } from "@/lib/logger";
import {
  canReadDetailedHealth,
  getEmailConfigurationStatus,
  getRetentionFreshness,
} from "@/lib/operational-health";
import { getEmailConfirmationStatus } from "@/lib/supabase/auth-health";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type RetentionRun = {
  status?: "running" | "completed" | "failed";
  started_at?: string | null;
  completed_at?: string | null;
};

const HEALTH_PROBE_TTL_MS = 30_000;
const DEGRADED_LOG_INTERVAL_MS = 5 * 60_000;

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

async function collectHealthSnapshot() {
  const probeStartedAt = Date.now();
  const admin = createAdminClient();
  const emailDelivery = getEmailConfigurationStatus();
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
    && emailDelivery.status !== "misconfigured"
    && cronAuthentication === "configured"
    && (dataRetention.status === "fresh" || dataRetention.status === "running");

  return {
    healthy,
    database,
    storage,
    emailConfirmation,
    emailDelivery,
    cronAuthentication,
    dataRetention,
    checkedAt: new Date().toISOString(),
    probeDurationMs: Date.now() - probeStartedAt,
  };
}

type HealthSnapshot = Awaited<ReturnType<typeof collectHealthSnapshot>>;
let cachedHealth:
  | { snapshot: HealthSnapshot; expiresAt: number }
  | null = null;
let inFlightHealthProbe: Promise<HealthSnapshot> | null = null;
let lastDegradedLogAt = 0;

async function getHealthSnapshot(now = Date.now()): Promise<HealthSnapshot> {
  if (cachedHealth && cachedHealth.expiresAt > now) return cachedHealth.snapshot;
  if (inFlightHealthProbe) return inFlightHealthProbe;

  inFlightHealthProbe = collectHealthSnapshot()
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

export async function GET(request: NextRequest) {
  const requestStartedAt = Date.now();
  const includeDetails = canReadDetailedHealth(request.headers.get("authorization"));
  const requestId = crypto.randomUUID();
  const snapshot = await getHealthSnapshot();

  if (
    !snapshot.healthy
    && requestStartedAt - lastDegradedLogAt >= DEGRADED_LOG_INTERVAL_MS
  ) {
    lastDegradedLogAt = requestStartedAt;
    logEvent("error", "health_check_failed", {
      requestId,
      database: snapshot.database,
      storage: snapshot.storage,
      emailConfirmation: snapshot.emailConfirmation,
      emailDeliveryStatus: snapshot.emailDelivery.status,
      cronAuthentication: snapshot.cronAuthentication,
      dataRetentionStatus: snapshot.dataRetention.status,
      probeDurationMs: snapshot.probeDurationMs,
    });
  }

  return NextResponse.json(
    includeDetails
      ? {
          status: snapshot.healthy ? "ok" : "degraded",
          requestId,
          checks: {
            database: snapshot.database,
            storage: snapshot.storage,
            emailConfirmation: snapshot.emailConfirmation,
            emailDelivery: snapshot.emailDelivery,
            cronAuthentication: snapshot.cronAuthentication,
            dataRetention: snapshot.dataRetention,
          },
          emailMode: snapshot.emailDelivery.mode,
          timestamp: snapshot.checkedAt,
          probeDurationMs: snapshot.probeDurationMs,
          responseDurationMs: Date.now() - requestStartedAt,
        }
      : {
          status: snapshot.healthy ? "ok" : "degraded",
          timestamp: snapshot.checkedAt,
        },
    {
      status: snapshot.healthy ? 200 : 503,
      headers: {
        "cache-control": "no-store",
        vary: "authorization",
        ...(!snapshot.healthy ? { "retry-after": "30" } : {}),
      },
    }
  );
}
