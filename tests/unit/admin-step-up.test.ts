import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  createClient: vi.fn(),
}));

vi.mock("@/lib/supabase/server", () => ({
  createClient: mocks.createClient,
}));
vi.mock("next/navigation", () => ({
  redirect: vi.fn(),
}));

import { hasRecentAdminAuthentication } from "@/lib/admin-step-up";

function accessToken(payload: Record<string, unknown>) {
  const encode = (value: unknown) => Buffer
    .from(JSON.stringify(value))
    .toString("base64url");
  return `${encode({ alg: "none" })}.${encode(payload)}.signature`;
}

function authClient(input: {
  userId?: string;
  method?: string;
  timestamp?: number;
}) {
  const userId = input.userId ?? "admin-1";
  return {
    auth: {
      getUser: vi.fn().mockResolvedValue({
        data: { user: { id: userId } },
        error: null,
      }),
      getSession: vi.fn().mockResolvedValue({
        data: {
          session: {
            access_token: accessToken({
              sub: userId,
              amr: input.method
                ? [{ method: input.method, timestamp: input.timestamp }]
                : [],
            }),
          },
        },
        error: null,
      }),
    },
  };
}

describe("administrator step-up authentication", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-07-30T18:00:00.000Z"));
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.clearAllMocks();
  });

  it.each(["password", "oauth"])("accepts a recent %s authentication", async (method) => {
    const timestamp = Math.floor(Date.now() / 1000) - 30;
    mocks.createClient.mockResolvedValue(authClient({ method, timestamp }));

    await expect(hasRecentAdminAuthentication()).resolves.toBe(true);
  });

  it("rejects a token refresh or authentication older than five minutes", async () => {
    const now = Math.floor(Date.now() / 1000);
    mocks.createClient.mockResolvedValue(authClient({
      method: "token_refresh",
      timestamp: now,
    }));
    await expect(hasRecentAdminAuthentication()).resolves.toBe(false);

    mocks.createClient.mockResolvedValue(authClient({
      method: "password",
      timestamp: now - 301,
    }));
    await expect(hasRecentAdminAuthentication()).resolves.toBe(false);
  });

  it("verifies that the signed-in user matches the expected administrator", async () => {
    const timestamp = Math.floor(Date.now() / 1000);
    mocks.createClient.mockResolvedValue(authClient({ method: "oauth", timestamp }));

    await expect(
      hasRecentAdminAuthentication(undefined, "different-admin")
    ).resolves.toBe(false);
  });
});
