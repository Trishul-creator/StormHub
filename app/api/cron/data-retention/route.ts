import { NextRequest, NextResponse } from "next/server";
import { runDataRetention } from "@/lib/data-retention";
import { processEmailOutbox } from "@/lib/email";
import { logEvent } from "@/lib/logger";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function GET(request: NextRequest) {
  const secret = process.env.CRON_SECRET?.trim();
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  try {
    const startedAt = Date.now();
    // Recover messages that could not be delivered by their immediate request.
    // The queue claim is lease-based, so this is safe alongside live sends.
    const email = await processEmailOutbox(24);
    const deleted = await runDataRetention();
    logEvent("info", "data_retention_completed", {
      durationMs: Date.now() - startedAt,
      emailAttempted: email.attempted,
      emailSent: email.sent,
      emailFailed: email.failed,
      deleted,
    });
    return NextResponse.json({ ok: true, email, deleted });
  } catch (error) {
    console.error(JSON.stringify({
      level: "error",
      event: "data_retention_failed",
      message: error instanceof Error ? error.message : "Unknown error",
      timestamp: new Date().toISOString(),
    }));
    return NextResponse.json({ error: "Data retention failed." }, { status: 500 });
  }
}
