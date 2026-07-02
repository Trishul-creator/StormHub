import { afterEach, describe, expect, it, vi } from "vitest";
import { getEmailDeliveryMode, isEmailDeliveryEnabled, isEmailOutboxEnabled } from "@/lib/email";

describe("email delivery mode decisions", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("disables both send and outbox when configured as disabled", () => {
    vi.stubEnv("EMAIL_DELIVERY_MODE", "disabled");
    expect(getEmailDeliveryMode()).toBe("disabled");
    expect(isEmailDeliveryEnabled()).toBe(false);
    expect(isEmailOutboxEnabled()).toBe(false);
  });

  it("queues outbox rows without provider sends in outbox_only mode", () => {
    vi.stubEnv("EMAIL_DELIVERY_MODE", "outbox_only");
    expect(getEmailDeliveryMode()).toBe("outbox_only");
    expect(isEmailDeliveryEnabled()).toBe(false);
    expect(isEmailOutboxEnabled()).toBe(true);
  });

  it("sends through provider only in send/resend mode", () => {
    vi.stubEnv("EMAIL_DELIVERY_MODE", "send");
    expect(getEmailDeliveryMode()).toBe("send");
    expect(isEmailDeliveryEnabled()).toBe(true);
    expect(isEmailOutboxEnabled()).toBe(true);

    vi.stubEnv("EMAIL_DELIVERY_MODE", "resend");
    expect(getEmailDeliveryMode()).toBe("send");
  });

  it("defaults to send if a Resend API key exists and no explicit mode is set", () => {
    vi.stubEnv("EMAIL_DELIVERY_MODE", "");
    vi.stubEnv("EMAIL_PROVIDER", "");
    vi.stubEnv("RESEND_API_KEY", "test-key");
    expect(getEmailDeliveryMode()).toBe("send");
  });

  it("uses outbox_only when no provider is configured", () => {
    vi.stubEnv("EMAIL_DELIVERY_MODE", "");
    vi.stubEnv("EMAIL_PROVIDER", "");
    vi.stubEnv("RESEND_API_KEY", "");
    expect(getEmailDeliveryMode()).toBe("outbox_only");
  });
});
