import { afterEach, describe, expect, it, vi } from "vitest";

import { getEmailConfirmationStatus } from "@/lib/supabase/auth-health";

describe("Supabase Auth health", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("reports required email confirmation when Auth does not auto-confirm", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify({
      mailer_autoconfirm: false,
      external: { email: true },
    }), { status: 200 })));

    await expect(getEmailConfirmationStatus(testEnvironment)).resolves.toBe("required");
  });

  it("reports disabled email confirmation when Auth auto-confirms", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify({
      mailer_autoconfirm: true,
      external: { email: true },
    }), { status: 200 })));

    await expect(getEmailConfirmationStatus(testEnvironment)).resolves.toBe("disabled");
  });

  it("reports unavailable when Auth settings cannot be read", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("network unavailable")));

    await expect(getEmailConfirmationStatus(testEnvironment)).resolves.toBe("unavailable");
  });
});

const testEnvironment = {
  NEXT_PUBLIC_SUPABASE_URL: "https://project.supabase.co",
  NEXT_PUBLIC_SUPABASE_ANON_KEY: "test-anon-key",
};
