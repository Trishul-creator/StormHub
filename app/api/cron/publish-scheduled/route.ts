import { NextRequest, NextResponse } from "next/server";
import { publishScheduledClubContent } from "@/lib/scheduled-content";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function GET(request: NextRequest) {
  const secret = process.env.CRON_SECRET?.trim();
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  try {
    const result = await publishScheduledClubContent();
    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    console.error(JSON.stringify({
      level: "error",
      event: "scheduled_content_publish_failed",
      message: error instanceof Error ? error.message : "Unknown error",
      timestamp: new Date().toISOString(),
    }));
    return NextResponse.json({ error: "Scheduled content processing failed." }, { status: 500 });
  }
}
