import { describe, expect, it } from "vitest";
import {
  getAllowedSignupDomains,
  getClientAddress,
  getSignupRateLimitConfig,
  hashSignupIdentifier,
  isMissingAllowedEmailDomainsColumn,
  parseSignupDomainInput,
  validateSignupEmailDomain,
  validateSignupBotProof,
} from "@/lib/signup-security";

describe("signup security", () => {
  it("rejects missing, filled, and implausibly fast bot proof", () => {
    expect(validateSignupBotProof(undefined, 10_000)).toBeTruthy();
    expect(validateSignupBotProof({ website: "spam.example", loadedAt: 1_000 }, 10_000)).toBeTruthy();
    expect(validateSignupBotProof({ website: "", loadedAt: 9_000 }, 10_000)).toBeTruthy();
    expect(validateSignupBotProof({ website: "", loadedAt: 8_000 }, 10_000)).toBeNull();
  });

  it("uses the first forwarded address and hashes identifiers consistently", () => {
    const headers = new Headers({ "x-forwarded-for": "203.0.113.4, 10.0.0.1" });
    expect(getClientAddress(headers)).toBe("203.0.113.4");
    expect(hashSignupIdentifier("Student@School.edu", "secret")).toBe(
      hashSignupIdentifier("student@school.edu", "secret")
    );
    expect(hashSignupIdentifier("student@school.edu", "secret")).not.toContain("student");
  });

  it("supports deployment-specific limits while retaining safe defaults", () => {
    expect(getSignupRateLimitConfig({})).toEqual({
      windowMinutes: 60,
      maxEmailAttempts: 5,
      maxIpAttempts: 50,
    });
    expect(getSignupRateLimitConfig({
      SIGNUP_RATE_LIMIT_WINDOW_MINUTES: "30",
      SIGNUP_MAX_ATTEMPTS_PER_EMAIL: "3",
      SIGNUP_MAX_ATTEMPTS_PER_IP: "20",
    })).toEqual({ windowMinutes: 30, maxEmailAttempts: 3, maxIpAttempts: 20 });
  });

  it("normalizes and deduplicates school and environment signup domains", () => {
    expect(getAllowedSignupDomains(
      [" Students.Example.edu ", "@staff.example.edu"],
      "staff.example.edu, district.example.org"
    )).toEqual(["students.example.edu", "staff.example.edu", "district.example.org"]);
  });

  it("enforces school domains for both password and Google signup", () => {
    expect(validateSignupEmailDomain("student@school.edu", ["school.edu"])).toBeNull();
    expect(validateSignupEmailDomain("student@gmail.com", ["*"])).toBeNull();
    expect(validateSignupEmailDomain("student@gmail.com", ["school.edu"])).toMatch(
      /approved school email address/i
    );
    expect(validateSignupEmailDomain("student@gmail.com", ["*"], "gmail.com")).toBe(
      "Please use a school email address."
    );
    expect(validateSignupEmailDomain("student@school.edu", [])).toMatch(
      /not configured for this school/i
    );
  });

  it("recognizes the legacy schema's missing signup-domain column", () => {
    expect(isMissingAllowedEmailDomainsColumn({
      code: "42703",
      message: "column schools.allowed_email_domains does not exist",
    })).toBe(true);
    expect(isMissingAllowedEmailDomainsColumn({
      code: "42501",
      message: "permission denied",
    })).toBe(false);
  });

  it("parses either a wildcard or a normalized domain restriction list", () => {
    expect(parseSignupDomainInput("*")).toEqual({ domains: ["*"], invalidDomains: [] });
    expect(parseSignupDomainInput("@Students.Example.edu, staff.example.edu")).toEqual({
      domains: ["students.example.edu", "staff.example.edu"],
      invalidDomains: [],
    });
    expect(parseSignupDomainInput("valid.example.edu, not a domain")).toEqual({
      domains: ["valid.example.edu"],
      invalidDomains: ["not a domain"],
    });
  });
});
