import { describe, expect, it } from "vitest";
import { shouldServePublicDemoContent } from "@/lib/public-content";

describe("public content boundary", () => {
  it("serves fictional content to every anonymous visitor", () => {
    expect(shouldServePublicDemoContent(null, false)).toBe(true);
    expect(shouldServePublicDemoContent(undefined, false)).toBe(true);
  });

  it("serves real scoped content only to authenticated profiles", () => {
    expect(shouldServePublicDemoContent({ id: "student-1" }, false)).toBe(false);
  });

  it("keeps local demo mode fictional even when a demo profile exists", () => {
    expect(shouldServePublicDemoContent({ id: "demo-user" }, true)).toBe(true);
  });
});
