import { NextRequest, NextResponse } from "next/server";
import { runDataRetention } from "@/lib/data-retention";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function GET(request: NextRequest) {
  const secret = process.env.CRON_SECRET?.trim();
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  try {
    const deleted = await runDataRetention();
    return NextResponse.json({ ok: true, deleted });
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
