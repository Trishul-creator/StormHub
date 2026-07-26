import { afterEach, describe, expect, it, vi } from "vitest";
import { verifyCaptchaToken } from "@/lib/captcha";

describe("contact CAPTCHA configuration", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("allows the rate-limited contact flow when CAPTCHA is intentionally disabled", async () => {
    vi.stubEnv("NEXT_PUBLIC_HCAPTCHA_SITE_KEY", "");
    vi.stubEnv("HCAPTCHA_SECRET_KEY", "");
    await expect(verifyCaptchaToken(null, "127.0.0.1")).resolves.toEqual({ success: true });
  });

  it("reports a partial CAPTCHA configuration clearly", async () => {
    vi.stubEnv("NEXT_PUBLIC_HCAPTCHA_SITE_KEY", "site-key");
    vi.stubEnv("HCAPTCHA_SECRET_KEY", "");
    await expect(verifyCaptchaToken(null, "127.0.0.1")).resolves.toEqual({
      success: false,
      error: "Security verification configuration is incomplete.",
    });
  });
});
