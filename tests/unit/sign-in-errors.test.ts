import { describe, expect, it } from "vitest";
import { friendlySignInError } from "@/lib/errors";

describe("friendlySignInError", () => {
  it("explains invalid credentials without revealing whether the email exists", () => {
    const expected = {
      kind: "credentials",
      title: "Incorrect email or password",
      message: "The email or password you entered is incorrect. Try again or reset your password.",
    };

    expect(friendlySignInError({
      name: "AuthApiError",
      code: "invalid_credentials",
      message: "Invalid login credentials",
      status: 400,
    })).toEqual(expected);
    expect(friendlySignInError({
      name: "AuthApiError",
      code: "user_not_found",
      message: "User not found",
      status: 400,
    })).toEqual(expected);
  });

  it("asks the user to confirm their email", () => {
    expect(friendlySignInError({
      code: "email_not_confirmed",
      message: "Email not confirmed",
      status: 400,
    })).toEqual({
      kind: "email_confirmation",
      title: "Email confirmation required",
      message: "Confirm your email address using the message StormHub sent you, then sign in again.",
    });
  });

  it("identifies a failed CAPTCHA", () => {
    expect(friendlySignInError({
      code: "captcha_failed",
      message: "captcha verification process failed",
      status: 400,
    })).toEqual({
      kind: "captcha",
      title: "CAPTCHA verification failed",
      message: "The CAPTCHA could not be verified. Complete it again and retry.",
    });
  });

  it("explains rate limiting", () => {
    expect(friendlySignInError({
      code: "over_request_rate_limit",
      message: "Too many requests",
      status: 429,
    })).toEqual({
      kind: "rate_limit",
      title: "Too many sign-in attempts",
      message: "Wait a few minutes before trying to sign in again.",
    });
  });

  it("explains suspended accounts", () => {
    expect(friendlySignInError({
      code: "user_banned",
      message: "User is banned",
      status: 400,
    })).toEqual({
      kind: "suspended",
      title: "Account suspended",
      message: "This account has been suspended. Contact your school administrator if you think this is a mistake.",
    });
  });

  it("distinguishes temporary service failures", () => {
    expect(friendlySignInError({
      name: "AuthRetryableFetchError",
      message: "Failed to fetch",
      status: 503,
    })).toEqual({
      kind: "temporary",
      title: "Sign-in service unavailable",
      message: "StormHub could not reach the sign-in service. Check your connection and try again shortly.",
    });
  });

  it("uses a useful fallback without exposing provider details", () => {
    expect(friendlySignInError({
      code: "unrecognized_auth_failure",
      message: "Internal provider detail",
      status: 400,
    })).toEqual({
      kind: "unknown",
      title: "Couldn’t sign in",
      message: "Something unexpected happened. Try again, or contact support if the problem continues.",
    });
  });
});
