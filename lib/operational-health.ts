import { getEmailDeliveryMode } from "@/lib/env";

type RetentionRun = {
  status?: "running" | "completed" | "failed";
  started_at?: string | null;
  completed_at?: string | null;
};

export function canReadDetailedHealth(
  authorization: string | null,
  env: Record<string, string | undefined> = process.env,
) {
  const secret = env.HEALTH_CHECK_SECRET?.trim() || env.CRON_SECRET?.trim();
  return Boolean(secret && authorization === `Bearer ${secret}`);
}

export function getEmailConfigurationStatus(
  env: Record<string, string | undefined> = process.env,
) {
  const mode = getEmailDeliveryMode(env);
  if (mode !== "send") {
    return { mode, status: mode } as const;
  }
  return {
    mode,
    status: env.RESEND_API_KEY?.trim() && env.EMAIL_FROM?.trim()
      ? "configured" as const
      : "misconfigured" as const,
  };
}

export function isEmailDeliveryReady(
  status: ReturnType<typeof getEmailConfigurationStatus>,
  env: Record<string, string | undefined> = process.env,
) {
  const isProduction = env.VERCEL_ENV === "production"
    || (!env.VERCEL_ENV && env.NODE_ENV === "production");

  if (isProduction) {
    return status.mode === "send" && status.status === "configured";
  }

  return status.status !== "misconfigured";
}

export function getRetentionFreshness(
  run: RetentionRun | null,
  now = Date.now(),
): {
  status: "fresh" | "running" | "stale" | "failed" | "missing";
  lastCompletedAt: string | null;
} {
  if (!run) return { status: "missing", lastCompletedAt: null };
  if (run.status === "failed") {
    return { status: "failed", lastCompletedAt: run.completed_at ?? null };
  }
  if (run.status === "running") {
    const startedAt = run.started_at ? new Date(run.started_at).getTime() : 0;
    return {
      status: startedAt > 0 && startedAt >= now - 2 * 60 * 60 * 1000
        ? "running"
        : "stale",
      lastCompletedAt: null,
    };
  }
  const completedAt = run.completed_at ? new Date(run.completed_at).getTime() : 0;
  return {
    status: completedAt > 0 && completedAt >= now - 36 * 60 * 60 * 1000
      ? "fresh"
      : "stale",
    lastCompletedAt: run.completed_at ?? null,
  };
}
