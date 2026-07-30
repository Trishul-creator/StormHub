import { describe, expect, it } from "vitest";

import {
  canReadDetailedHealth,
  getEmailConfigurationStatus,
  getRetentionFreshness,
} from "@/lib/operational-health";

describe("operational health reporting", () => {
  it("keeps detailed diagnostics behind a server-only bearer secret", () => {
    const env = {
      HEALTH_CHECK_SECRET: "health-secret",
      CRON_SECRET: "cron-fallback",
    };
    expect(canReadDetailedHealth("Bearer health-secret", env)).toBe(true);
    expect(canReadDetailedHealth("Bearer cron-fallback", env)).toBe(false);
    expect(canReadDetailedHealth(null, env)).toBe(false);
    expect(canReadDetailedHealth("Bearer health-secret", {})).toBe(false);
  });

  it("reports email configuration without returning secret values", () => {
    const configured = getEmailConfigurationStatus({
      EMAIL_DELIVERY_MODE: "send",
      RESEND_API_KEY: "secret-resend-key",
      EMAIL_FROM: "StormHub <noreply@stormhubapp.com>",
    });

    expect(configured).toEqual({ mode: "send", status: "configured" });
    expect(JSON.stringify(configured)).not.toContain("secret-resend-key");
    expect(getEmailConfigurationStatus({
      EMAIL_DELIVERY_MODE: "send",
      RESEND_API_KEY: "",
      EMAIL_FROM: "",
    })).toEqual({ mode: "send", status: "misconfigured" });
  });

  it("treats a completed daily retention run as fresh for 36 hours", () => {
    const now = new Date("2026-07-30T12:00:00.000Z").getTime();

    expect(getRetentionFreshness({
      status: "completed",
      started_at: "2026-07-30T09:00:00.000Z",
      completed_at: "2026-07-30T09:05:00.000Z",
    }, now)).toEqual({
      status: "fresh",
      lastCompletedAt: "2026-07-30T09:05:00.000Z",
    });
  });

  it("surfaces failed, stale, and missing retention runs", () => {
    const now = new Date("2026-07-30T12:00:00.000Z").getTime();

    expect(getRetentionFreshness(null, now).status).toBe("missing");
    expect(getRetentionFreshness({
      status: "failed",
      completed_at: "2026-07-30T09:05:00.000Z",
    }, now).status).toBe("failed");
    expect(getRetentionFreshness({
      status: "completed",
      completed_at: "2026-07-28T09:05:00.000Z",
    }, now).status).toBe("stale");
  });
});
