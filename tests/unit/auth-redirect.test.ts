import { describe, expect, it } from "vitest";
import { safeAuthRedirectPath } from "@/lib/auth-redirect";

describe("safeAuthRedirectPath", () => {
  it("keeps local paths and rejects external or ambiguous redirects", () => {
    expect(safeAuthRedirectPath("/opportunities/robotics")).toBe("/opportunities/robotics");
    expect(safeAuthRedirectPath("https://evil.example")).toBe("/dashboard");
    expect(safeAuthRedirectPath("//evil.example")).toBe("/dashboard");
    expect(safeAuthRedirectPath("/\\evil.example")).toBe("/dashboard");
  });
});
