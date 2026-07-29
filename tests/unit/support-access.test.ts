import { describe, expect, it } from "vitest";
import { isPlatformSupportSchemaMissing } from "@/lib/support-access";

describe("platform support availability", () => {
  it("recognizes both Postgres and PostgREST missing-table errors", () => {
    expect(isPlatformSupportSchemaMissing({
      code: "42P01",
      message: 'relation "platform_support_sessions" does not exist',
    })).toBe(true);
    expect(isPlatformSupportSchemaMissing({
      code: "PGRST205",
      message: "Could not find the table 'public.platform_support_sessions' in the schema cache",
    })).toBe(true);
  });

  it("does not mislabel unrelated service errors as a missing migration", () => {
    expect(isPlatformSupportSchemaMissing({
      code: "42501",
      message: "permission denied for table profiles",
    })).toBe(false);
    expect(isPlatformSupportSchemaMissing(null)).toBe(false);
  });
});
