import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getEmailDeliveryMode } from "@/lib/env";
import { logEvent } from "@/lib/logger";
import { getEmailConfirmationStatus } from "@/lib/supabase/auth-health";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const startedAt = Date.now();
  const requestId = crypto.randomUUID();
  const admin = createAdminClient();

  const [emailConfirmation, database] = await Promise.all([
    getEmailConfirmationStatus(),
    (async () => {
      if (!admin) return "unavailable" as const;
      const { error } = await admin.from("schools").select("id", { head: true, count: "exact" }).limit(1);
      return error ? "unavailable" as const : "ok" as const;
    })(),
  ]);

  const healthy = database === "ok" && emailConfirmation === "required";
  if (!healthy) {
    logEvent("error", "health_check_failed", {
      requestId,
      database,
      emailConfirmation,
      durationMs: Date.now() - startedAt,
    });
  }

  return NextResponse.json(
    {
      status: healthy ? "ok" : "degraded",
      requestId,
      checks: { database, emailConfirmation },
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
