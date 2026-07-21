import { beforeEach, describe, expect, it, vi } from "vitest";

const { createBrowserClient } = vi.hoisted(() => ({
  createBrowserClient: vi.fn(() => ({ configured: true })),
}));

vi.mock("@supabase/ssr", () => ({ createBrowserClient }));

import { createClient, isSupabaseConfigured } from "@/lib/supabase/client";

describe("browser Supabase configuration", () => {
  beforeEach(() => {
    createBrowserClient.mockClear();
    vi.unstubAllEnvs();
  });

  it("creates a browser client from public environment variables", () => {
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", " https://staging.supabase.co ");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY", " anon-key ");

    expect(isSupabaseConfigured()).toBe(true);
    expect(createClient()).toEqual({ configured: true });
    expect(createBrowserClient).toHaveBeenCalledWith("https://staging.supabase.co", "anon-key");
  });

  it("does not create a browser client when either public value is missing", () => {
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://staging.supabase.co");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY", "");

    expect(isSupabaseConfigured()).toBe(false);
    expect(createClient()).toBeNull();
    expect(createBrowserClient).not.toHaveBeenCalled();
  });
});
