import { NextRequest, NextResponse } from "next/server";
import { logEvent } from "@/lib/logger";
import { canReadDetailedHealth } from "@/lib/operational-health";
import { getSystemHealthSnapshot } from "@/lib/system-health";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const DEGRADED_LOG_INTERVAL_MS = 5 * 60_000;
let lastDegradedLogAt = 0;

export async function GET(request: NextRequest) {
  const requestStartedAt = Date.now();
  const includeDetails = canReadDetailedHealth(request.headers.get("authorization"));
  const requestId = crypto.randomUUID();
  const snapshot = await getSystemHealthSnapshot();

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
            emailDelivery: {
              ...snapshot.emailDelivery,
              ready: snapshot.emailDeliveryReady,
            },
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
