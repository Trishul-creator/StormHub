import { describe, expect, it } from "vitest";

import {
  getEmailDeliveryMode,
  getGroqApiKey,
  getSupabaseAnonKey,
  getSupabaseServiceRoleKey,
  getSupabaseUrl,
  isAssistantEnabled,
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

  it("disables assistant without Groq or in explicit staging E2E", () => {
    expect(isAssistantEnabled({ GROQ_API_KEY: "key" })).toBe(true);
    expect(getGroqApiKey({ GROQ_API_KEY: "key" })).toBe("key");
    expect(isAssistantEnabled({ GROQ_API_KEY: "key", E2E_ENVIRONMENT: "staging" })).toBe(false);
    expect(isAssistantEnabled({ GROQ_API_KEY: "key", AI_FEATURES_ENABLED: "false" })).toBe(false);
    expect(isAssistantEnabled({ GROQ_API_KEY: "key", GROQ_ENABLED: "false" })).toBe(false);
    expect(isAssistantEnabled({})).toBe(false);
  });
});
