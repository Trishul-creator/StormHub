import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getEmailDeliveryMode } from "@/lib/env";
import { logEvent } from "@/lib/logger";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const startedAt = Date.now();
  const requestId = crypto.randomUUID();
  const admin = createAdminClient();
  let database: "ok" | "unavailable" = "unavailable";

  if (admin) {
    const { error } = await admin.from("schools").select("id", { head: true, count: "exact" }).limit(1);
    database = error ? "unavailable" : "ok";
  }

  const healthy = database === "ok";
  if (!healthy) {
    logEvent("error", "health_check_failed", { requestId, database, durationMs: Date.now() - startedAt });
  }

  return NextResponse.json(
    {
      status: healthy ? "ok" : "degraded",
      requestId,
      checks: { database },
      emailMode: getEmailDeliveryMode(),
      timestamp: new Date().toISOString(),
      durationMs: Date.now() - startedAt,
    },
    {
      status: healthy ? 200 : 503,
      headers: { "cache-control": "no-store" },
    }
  );
}
