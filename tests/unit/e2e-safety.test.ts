import { describe, expect, it } from "vitest";

import {
  allowsMutatingE2E,
  assertEmailE2ESafe,
  assertMutatingE2ESafe,
  hasSafeE2EEmailMode,
  isStagingE2E,
} from "../e2e/safety";

describe("E2E safety guards", () => {
  it("requires explicit staging environment for staging E2E", () => {
    expect(isStagingE2E({ E2E_ENVIRONMENT: "staging" })).toBe(true);
    expect(isStagingE2E({ E2E_ENVIRONMENT: "production" })).toBe(false);
    expect(isStagingE2E({})).toBe(false);
  });

  it("allows mutating E2E only when both staging and mutation opt-in are set", () => {
    expect(allowsMutatingE2E({ E2E_ENVIRONMENT: "staging", E2E_ALLOW_MUTATIONS: "true" })).toBe(true);
    expect(allowsMutatingE2E({ E2E_ENVIRONMENT: "staging", E2E_ALLOW_MUTATIONS: "false" })).toBe(false);
    expect(allowsMutatingE2E({ E2E_ENVIRONMENT: "production", E2E_ALLOW_MUTATIONS: "true" })).toBe(false);
  });

  it("requires outbox-only mode for email E2E", () => {
    expect(hasSafeE2EEmailMode({ EMAIL_DELIVERY_MODE: "outbox_only" })).toBe(true);
    expect(hasSafeE2EEmailMode({ EMAIL_DELIVERY_MODE: "send" })).toBe(false);
    expect(hasSafeE2EEmailMode({})).toBe(false);
  });

  it("throws loudly for unsafe mutation/email E2E config", () => {
    expect(() => assertMutatingE2ESafe({ E2E_ENVIRONMENT: "production", E2E_ALLOW_MUTATIONS: "true" })).toThrow(
      /Mutating E2E requires/
    );
    expect(() => assertEmailE2ESafe({ EMAIL_DELIVERY_MODE: "send" })).toThrow(/outbox_only/);
  });
});
