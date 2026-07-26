import { describe, expect, it } from "vitest";

import {
  getAuthCallbackUrl,
  getEmailDeliveryMode,
  getGoogleDriveServerConfig,
  getGroqApiKey,
  getSupabaseAnonKey,
  getSupabaseServiceRoleKey,
  getSupabaseUrl,
  isAssistantEnabled,
  isGoogleDrivePickerConfigured,
} from "@/lib/env";

describe("environment resolver", () => {
  it("prefers normal Supabase app env names", () => {
    const env = {
      NEXT_PUBLIC_SUPABASE_URL: "https://normal.example",
      NEXT_PUBLIC_SUPABASE_ANON_KEY: "normal-anon",
      SUPABASE_SERVICE_ROLE_KEY: "normal-service",
      E2E_ENVIRONMENT: "staging",
      STAGING_NEXT_PUBLIC_SUPABASE_URL: "https://staging.example",
      STAGING_NEXT_PUBLIC_SUPABASE_ANON_KEY: "staging-anon",
      STAGING_SUPABASE_SERVICE_ROLE_KEY: "staging-service",
    };

    expect(getSupabaseUrl(env)).toBe("https://normal.example");
    expect(getSupabaseAnonKey(env)).toBe("normal-anon");
    expect(getSupabaseServiceRoleKey(env)).toBe("normal-service");
  });

  it("allows staging-prefixed Supabase names only for explicit staging E2E", () => {
    const env = {
      E2E_ENVIRONMENT: "staging",
      STAGING_NEXT_PUBLIC_SUPABASE_URL: "https://staging.example",
      STAGING_NEXT_PUBLIC_SUPABASE_ANON_KEY: "staging-anon",
      STAGING_SUPABASE_SERVICE_ROLE_KEY: "staging-service",
    };

    expect(getSupabaseUrl(env)).toBe("https://staging.example");
    expect(getSupabaseAnonKey(env)).toBe("staging-anon");
    expect(getSupabaseServiceRoleKey(env)).toBe("staging-service");
  });

  it("throws clear Supabase errors outside staging when values are missing", () => {
    expect(() => getSupabaseUrl({})).toThrow(/NEXT_PUBLIC_SUPABASE_URL/);
    expect(() => getSupabaseAnonKey({})).toThrow(/NEXT_PUBLIC_SUPABASE_ANON_KEY/);
    expect(() => getSupabaseServiceRoleKey({})).toThrow(/SUPABASE_SERVICE_ROLE_KEY/);
  });

  it("forces staging E2E email to outbox-only even if send is misconfigured", () => {
    expect(getEmailDeliveryMode({ E2E_ENVIRONMENT: "staging", EMAIL_DELIVERY_MODE: "send" })).toBe("outbox_only");
    expect(getEmailDeliveryMode({ EMAIL_DELIVERY_MODE: "send", RESEND_API_KEY: "key" })).toBe("send");
    expect(getEmailDeliveryMode({ EMAIL_PROVIDER: "disabled" })).toBe("disabled");
  });

  it("builds email confirmation callbacks from the configured public site", () => {
    expect(getAuthCallbackUrl({ NEXT_PUBLIC_SITE_URL: "https://stormhubapp.com/" })).toBe(
      "https://stormhubapp.com/auth/callback"
    );
    expect(getAuthCallbackUrl({ NEXT_PUBLIC_SITE_URL: "http://localhost:3000" })).toBe(
      "http://localhost:3000/auth/callback"
    );
    expect(getAuthCallbackUrl({ NEXT_PUBLIC_APP_URL: "https://preview.stormhubapp.com/" })).toBe(
      "https://preview.stormhubapp.com/auth/callback"
    );
  });

  it("requires the complete Google Drive server and Picker configuration", () => {
    const env = {
      NEXT_PUBLIC_SITE_URL: "https://stormhubapp.com",
      GOOGLE_DRIVE_CLIENT_ID: "client-id",
      GOOGLE_DRIVE_CLIENT_SECRET: "client-secret",
      GOOGLE_DRIVE_TOKEN_ENCRYPTION_KEY: "a".repeat(64),
      NEXT_PUBLIC_GOOGLE_DRIVE_API_KEY: "browser-key",
      NEXT_PUBLIC_GOOGLE_DRIVE_APP_ID: "123456789",
    };

    expect(getGoogleDriveServerConfig(env)).toEqual({
      clientId: "client-id",
      clientSecret: "client-secret",
      tokenEncryptionKey: "a".repeat(64),
      redirectUri: "https://stormhubapp.com/api/integrations/google-drive/callback",
    });
    expect(isGoogleDrivePickerConfigured(env)).toBe(true);
    expect(getGoogleDriveServerConfig({})).toBeNull();
    expect(isGoogleDrivePickerConfigured({ ...env, NEXT_PUBLIC_GOOGLE_DRIVE_API_KEY: "" })).toBe(false);
  });

  it("disables assistant without Groq or in explicit staging E2E", () => {
    const approvedEnv = {
      GROQ_API_KEY: "key",
      AI_FEATURES_ENABLED: "true",
      GROQ_ENABLED: "true",
      AI_DATA_SHARING_APPROVED: "true",
    };

    expect(isAssistantEnabled({ GROQ_API_KEY: "key" })).toBe(false);
    expect(getGroqApiKey({ GROQ_API_KEY: "key" })).toBeNull();
    expect(isAssistantEnabled(approvedEnv)).toBe(true);
    expect(getGroqApiKey(approvedEnv)).toBe("key");
    expect(isAssistantEnabled({ ...approvedEnv, E2E_ENVIRONMENT: "staging" })).toBe(false);
    expect(isAssistantEnabled({ ...approvedEnv, AI_FEATURES_ENABLED: "false" })).toBe(false);
    expect(isAssistantEnabled({ ...approvedEnv, GROQ_ENABLED: "false" })).toBe(false);
    expect(isAssistantEnabled({ ...approvedEnv, AI_DATA_SHARING_APPROVED: "false" })).toBe(false);
    expect(isAssistantEnabled({})).toBe(false);
  });
});
