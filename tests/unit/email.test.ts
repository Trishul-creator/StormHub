import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  getEmailDeliveryMode,
  isEmailDeliveryEnabled,
  isEmailOutboxEnabled,
  sendEmail,
} from "@/lib/email";

describe("email delivery mode decisions", () => {
  beforeEach(() => {
    vi.stubEnv("NEXT_PUBLIC_DEMO_MODE", "false");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://test.supabase.co");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY", "test-anon-key");
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
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

  it("forces explicit staging E2E to outbox-only even if send env is present", () => {
    vi.stubEnv("E2E_ENVIRONMENT", "staging");
    vi.stubEnv("EMAIL_DELIVERY_MODE", "send");
    vi.stubEnv("RESEND_API_KEY", "test-key");
    expect(getEmailDeliveryMode()).toBe("outbox_only");
    expect(isEmailDeliveryEnabled()).toBe(false);
    expect(isEmailOutboxEnabled()).toBe(true);
  });

  it("uses outbox_only when no provider is configured", () => {
    vi.stubEnv("EMAIL_DELIVERY_MODE", "");
    vi.stubEnv("EMAIL_PROVIDER", "");
    vi.stubEnv("RESEND_API_KEY", "");
    expect(getEmailDeliveryMode()).toBe("outbox_only");
  });

  it("sends through Resend with a stable idempotency key and records the provider id", async () => {
    vi.stubEnv("EMAIL_DELIVERY_MODE", "send");
    vi.stubEnv("RESEND_API_KEY", "resend-key");
    vi.stubEnv("EMAIL_FROM", "StormHub <noreply@stormhubapp.com>");
    vi.stubEnv("NEXT_PUBLIC_APP_URL", "https://stormhubapp.com");
    const fetchMock = vi.fn().mockResolvedValue(new Response(
      JSON.stringify({ id: "provider-message-1" }),
      { status: 200 },
    ));
    vi.stubGlobal("fetch", fetchMock);

    const result = await sendEmail({
      to: "student@example.com",
      subject: "Assignment ready",
      body: "Open in StormHub: /clubs/robotics",
      idempotencyKey: "stormhub-email-outbox-1",
    });

    expect(result).toEqual({
      success: true,
      providerMessageId: "provider-message-1",
      retryable: false,
    });
    expect(fetchMock).toHaveBeenCalledWith(
      "https://api.resend.com/emails",
      expect.objectContaining({
        headers: expect.objectContaining({
          "Idempotency-Key": "stormhub-email-outbox-1",
        }),
      }),
    );
    const body = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(body.text).toContain("https://stormhubapp.com/clubs/robotics");
  });

  it("retries a transient provider failure within a bounded attempt count", async () => {
    vi.stubEnv("EMAIL_DELIVERY_MODE", "send");
    vi.stubEnv("RESEND_API_KEY", "resend-key");
    vi.stubEnv("EMAIL_FROM", "StormHub <noreply@stormhubapp.com>");
    vi.stubEnv("EMAIL_PROVIDER_MAX_ATTEMPTS", "2");
    vi.stubEnv("EMAIL_PROVIDER_RETRY_DELAY_MS", "0");
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response(
        JSON.stringify({ message: "Temporarily unavailable" }),
        { status: 503 },
      ))
      .mockResolvedValueOnce(new Response(
        JSON.stringify({ id: "provider-message-2" }),
        { status: 200 },
      ));
    vi.stubGlobal("fetch", fetchMock);

    await expect(sendEmail({
      to: "student@example.com",
      subject: "Retry",
      body: "Hello",
      idempotencyKey: "stormhub-email-outbox-2",
    })).resolves.toMatchObject({
      success: true,
      providerMessageId: "provider-message-2",
    });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("does not retry a permanent provider rejection", async () => {
    vi.stubEnv("EMAIL_DELIVERY_MODE", "send");
    vi.stubEnv("RESEND_API_KEY", "resend-key");
    vi.stubEnv("EMAIL_FROM", "StormHub <noreply@stormhubapp.com>");
    vi.stubEnv("EMAIL_PROVIDER_MAX_ATTEMPTS", "3");
    vi.stubEnv("EMAIL_PROVIDER_RETRY_DELAY_MS", "0");
    const fetchMock = vi.fn().mockResolvedValue(new Response(
      JSON.stringify({ message: "Invalid recipient" }),
      { status: 422 },
    ));
    vi.stubGlobal("fetch", fetchMock);

    await expect(sendEmail({
      to: "invalid",
      subject: "Rejected",
      body: "Hello",
    })).resolves.toEqual({
      success: false,
      error: "Invalid recipient",
      retryable: false,
    });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
