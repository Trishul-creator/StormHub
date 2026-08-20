import { describe, expect, it } from "vitest";

import {
  assertElkhornDemoSeedEnvironment,
  isElkhornDemoDeployment,
  supabaseProjectRef,
} from "@/lib/demo-environment";
import {
  DEMO_ACCOUNTS,
  DEMO_CLUBS,
  DEMO_EMAIL_DOMAIN,
  DEMO_IDS,
  DEMO_SCHOOLS,
  PRIMARY_DEMO_ACCOUNT_KEYS,
} from "../../scripts/demo/elkhorn-manifest";

const safeEnv = {
  STORMHUB_DEMO_MODE: "true",
  ALLOW_ELKHORN_DEMO_SEED: "ELKHORN_DEMO_CONFIRMED",
  STORMHUB_DEMO_TARGET: "preview",
  DEMO_SUPABASE_PROJECT_REF: "fictional-preview-ref",
  NEXT_PUBLIC_SUPABASE_URL: "https://fictional-preview-ref.supabase.co",
  DEMO_ACCOUNT_PASSWORD: "Strong-Demo-Pass9!",
  NODE_ENV: "test",
  VERCEL_ENV: "preview",
};

describe("Elkhorn demo environment safety", () => {
  it("accepts an explicitly confirmed nonproduction project", () => {
    expect(assertElkhornDemoSeedEnvironment(safeEnv)).toEqual({
      projectRef: "fictional-preview-ref",
      password: "Strong-Demo-Pass9!",
    });
    expect(isElkhornDemoDeployment(safeEnv)).toBe(true);
  });

  it("refuses production and mismatched hosted project references", () => {
    expect(() => assertElkhornDemoSeedEnvironment({ ...safeEnv, VERCEL_ENV: "production" }))
      .toThrow(/VERCEL_ENV=production/);
    expect(() => assertElkhornDemoSeedEnvironment({
      ...safeEnv,
      NEXT_PUBLIC_SUPABASE_URL: "https://wtdviuwwvoouypybutod.supabase.co",
      DEMO_SUPABASE_PROJECT_REF: "wtdviuwwvoouypybutod",
    })).toThrow(/production Supabase project/);
    expect(() => assertElkhornDemoSeedEnvironment({
      ...safeEnv,
      DEMO_SUPABASE_PROJECT_REF: "different-project",
    })).toThrow(/must exactly match/);
  });

  it("requires every confirmation and a strong password", () => {
    expect(() => assertElkhornDemoSeedEnvironment({ ...safeEnv, STORMHUB_DEMO_MODE: "false" }))
      .toThrow(/STORMHUB_DEMO_MODE/);
    expect(() => assertElkhornDemoSeedEnvironment({ ...safeEnv, ALLOW_ELKHORN_DEMO_SEED: "yes" }))
      .toThrow(/ALLOW_ELKHORN_DEMO_SEED/);
    expect(() => assertElkhornDemoSeedEnvironment({ ...safeEnv, DEMO_ACCOUNT_PASSWORD: "weak" }))
      .toThrow(/at least 16 characters/);
  });

  it("recognizes local and hosted Supabase project references", () => {
    expect(supabaseProjectRef("http://127.0.0.1:54321")).toBe("local");
    expect(supabaseProjectRef("https://branch-ref.supabase.co")).toBe("branch-ref");
    expect(supabaseProjectRef("not-a-url")).toBeNull();
  });
});

describe("Elkhorn demo manifest", () => {
  it("contains only fictional demo-domain identities and stable unique records", () => {
    expect(DEMO_ACCOUNTS).toHaveLength(29);
    expect(DEMO_SCHOOLS).toHaveLength(3);
    expect(DEMO_CLUBS).toHaveLength(18);
    expect(new Set(DEMO_ACCOUNTS.map((account) => account.email)).size).toBe(DEMO_ACCOUNTS.length);
    expect(new Set(DEMO_CLUBS.map((club) => club.slug)).size).toBe(DEMO_CLUBS.length);
    expect(DEMO_ACCOUNTS.every((account) => account.email.endsWith(`@${DEMO_EMAIL_DOMAIN}`))).toBe(true);
    expect(JSON.stringify({ DEMO_ACCOUNTS, DEMO_CLUBS, DEMO_SCHOOLS }).toLowerCase()).not.toContain("@epsne.org");
    expect(Object.values(DEMO_IDS.clubs)).toHaveLength(DEMO_CLUBS.length);
  });

  it("includes every primary live-demo account and the prepared role story", () => {
    expect(PRIMARY_DEMO_ACCOUNT_KEYS).toEqual(["dana", "alex", "elena", "jordan", "maya"]);
    expect(DEMO_ACCOUNTS.find((account) => account.key === "dana")?.role).toBe("district_admin");
    expect(DEMO_ACCOUNTS.find((account) => account.key === "alex")?.role).toBe("admin");
    expect(DEMO_ACCOUNTS.find((account) => account.key === "elena")?.role).toBe("teacher");
    expect(DEMO_ACCOUNTS.find((account) => account.key === "jordan")?.role).toBe("student");
    expect(DEMO_ACCOUNTS.find((account) => account.key === "maya")?.role).toBe("student");
  });
});
