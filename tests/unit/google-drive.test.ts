import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  createGoogleOAuthState,
  decryptGoogleToken,
  encryptGoogleToken,
  verifyGoogleOAuthState,
} from "@/lib/google-drive";

describe("Google Drive credential protection", () => {
  beforeEach(() => {
    process.env.GOOGLE_DRIVE_CLIENT_ID = "client-id";
    process.env.GOOGLE_DRIVE_CLIENT_SECRET = "client-secret";
    process.env.GOOGLE_DRIVE_TOKEN_ENCRYPTION_KEY = "a".repeat(64);
    process.env.NEXT_PUBLIC_SITE_URL = "https://stormhubapp.com";
  });

  afterEach(() => {
    vi.useRealTimers();
    delete process.env.GOOGLE_DRIVE_CLIENT_ID;
    delete process.env.GOOGLE_DRIVE_CLIENT_SECRET;
    delete process.env.GOOGLE_DRIVE_TOKEN_ENCRYPTION_KEY;
  });

  it("encrypts stored OAuth tokens with authenticated encryption", () => {
    const encrypted = encryptGoogleToken("refresh-token-value");

    expect(encrypted).not.toContain("refresh-token-value");
    expect(decryptGoogleToken(encrypted)).toBe("refresh-token-value");
    expect(() => decryptGoogleToken(`${encrypted.slice(0, -1)}x`)).toThrow();
  });

  it("signs OAuth state and rejects tampering or expiration", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-07-26T12:00:00.000Z"));
    const state = createGoogleOAuthState({
      userId: "user-1",
      nonce: "nonce-1",
      returnTo: "/clubs/science-bowl/member",
    });

    expect(verifyGoogleOAuthState(state)).toMatchObject({
      userId: "user-1",
      nonce: "nonce-1",
      returnTo: "/clubs/science-bowl/member",
    });
    expect(verifyGoogleOAuthState(`${state.slice(0, -1)}x`)).toBeNull();
    vi.advanceTimersByTime(11 * 60 * 1000);
    expect(verifyGoogleOAuthState(state)).toBeNull();
  });

  it("prevents external OAuth return URLs", () => {
    const state = createGoogleOAuthState({
      userId: "user-1",
      nonce: "nonce-1",
      returnTo: "https://attacker.example/collect",
    });

    expect(verifyGoogleOAuthState(state)?.returnTo).toBe("/settings");
  });
});
