import { NextRequest, NextResponse } from "next/server";
import { processWeeklyDigests } from "@/lib/digest";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function GET(request: NextRequest) {
  const secret = process.env.CRON_SECRET?.trim();
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  try {
    const result = await processWeeklyDigests();
    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    console.error(JSON.stringify({
      level: "error",
      event: "weekly_digest_failed",
      message: error instanceof Error ? error.message : "Unknown error",
      timestamp: new Date().toISOString(),
    }));
    return NextResponse.json({ error: "Digest processing failed." }, { status: 500 });
  }
}
