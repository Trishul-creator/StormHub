/** Map Supabase/Postgres errors to user-friendly messages. */
export function friendlyError(error: unknown, fallback = "Something went wrong. Please try again."): string {
  if (!error) return fallback;
  const msg = errorMessage(error);
  const code = errorProperty(error, "code");

  if (code === "42P01" || msg.includes("does not exist")) {
    return "Database tables are not set up yet. Run supabase/setup.sql in your Supabase SQL Editor.";
  }
  if (code === "23505" || msg.includes("duplicate")) {
    return "You have already done this action.";
  }
  if (msg.includes("JWT") || msg.includes("session")) {
    return "Your session expired. Please sign in again.";
  }
  if (msg.includes("permission denied") || code === "42501") {
    return "You do not have permission to do that.";
  }
  if (msg.toLowerCase().includes("email not confirmed")) {
    return "Confirm your email address before signing in.";
  }
  if (process.env.NODE_ENV === "development") {
    console.error("[StormHub]", error);
  }
  return fallback;
}

/** Map Supabase Auth mailer failures without leaking provider details to students. */
export function friendlyAuthEmailError(
  error: unknown,
  fallback = "We couldn't send the verification email. Please try again later or contact your school administrator."
): string {
  if (!error) return fallback;

  const message = errorMessage(error).toLowerCase();
  const name = errorProperty(error, "name");
  const status = Number(errorProperty(error, "status"));
  const isMailerFailure =
    message.includes("error sending confirmation email")
    || message.includes("error sending recovery email")
    || message.includes("email address not authorized")
    || message.includes("smtp");
  const isOpaqueAuthServiceFailure =
    name === "AuthRetryableFetchError"
    && status >= 500;

  if (message.includes("email rate limit exceeded") || status === 429) {
    return "Too many verification emails have been requested. Wait a few minutes before trying again.";
  }
  if (isMailerFailure || isOpaqueAuthServiceFailure) {
    return fallback;
  }

  return friendlyError(error, fallback);
}

export type FriendlySignInError = {
  kind:
    | "captcha"
    | "credentials"
    | "email_confirmation"
    | "invalid_email"
    | "rate_limit"
    | "suspended"
    | "temporary"
    | "unknown";
  title: string;
  message: string;
};

/**
 * Translate Supabase Auth failures without exposing whether an arbitrary
 * email address belongs to an account.
 */
export function friendlySignInError(error: unknown): FriendlySignInError {
  const message = errorMessage(error).toLowerCase();
  const code = errorProperty(error, "code").toLowerCase();
  const name = errorProperty(error, "name");
  const status = Number(errorProperty(error, "status"));

  if (code === "captcha_failed" || message.includes("captcha")) {
    return {
      kind: "captcha",
      title: "CAPTCHA verification failed",
      message: "The CAPTCHA could not be verified. Complete it again and retry.",
    };
  }

  if (code === "email_not_confirmed" || message.includes("email not confirmed")) {
    return {
      kind: "email_confirmation",
      title: "Email confirmation required",
      message: "Confirm your email address using the message StormHub sent you, then sign in again.",
    };
  }

  if (code === "user_banned" || message.includes("user is banned") || message.includes("account is banned")) {
    return {
      kind: "suspended",
      title: "Account suspended",
      message: "This account has been suspended. Contact your school administrator if you think this is a mistake.",
    };
  }

  if (
    code === "invalid_credentials"
    || code === "user_not_found"
    || message.includes("invalid login credentials")
    || message.includes("invalid credentials")
    || message.includes("invalid password")
  ) {
    return {
      kind: "credentials",
      title: "Incorrect email or password",
      message: "The email or password you entered is incorrect. Try again or reset your password.",
    };
  }

  if (code === "email_address_invalid" || message.includes("invalid email")) {
    return {
      kind: "invalid_email",
      title: "Check your email address",
      message: "Enter a valid email address and try again.",
    };
  }

  if (
    status === 429
    || code === "over_request_rate_limit"
    || code === "over_email_send_rate_limit"
    || message.includes("rate limit")
    || message.includes("too many requests")
  ) {
    return {
      kind: "rate_limit",
      title: "Too many sign-in attempts",
      message: "Wait a few minutes before trying to sign in again.",
    };
  }

  if (
    name === "AuthRetryableFetchError"
    || status >= 500
    || code === "request_timeout"
    || code === "unexpected_failure"
    || message.includes("failed to fetch")
    || message.includes("network request failed")
  ) {
    return {
      kind: "temporary",
      title: "Sign-in service unavailable",
      message: "StormHub could not reach the sign-in service. Check your connection and try again shortly.",
    };
  }

  if (process.env.NODE_ENV === "development") {
    console.error("[StormHub sign-in]", error);
  }
  return {
    kind: "unknown",
    title: "Couldn’t sign in",
    message: "Something unexpected happened. Try again, or contact support if the problem continues.",
  };
}

export class SetupRequiredError extends Error {
  constructor() {
    super("SETUP_REQUIRED");
    this.name = "SetupRequiredError";
  }
}

export function isSetupRequired(error: unknown): boolean {
  if (error instanceof SetupRequiredError) return true;
  const msg = errorMessage(error);
  return msg.includes("does not exist") || msg.includes("SETUP_REQUIRED");
}

function errorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  if (typeof error === "object" && error !== null) {
    for (const property of ["message", "msg", "error_description"] as const) {
      const value = errorProperty(error, property);
      if (value) return value;
    }
  }
  return String(error);
}

function errorProperty(error: unknown, property: string): string {
  if (typeof error !== "object" || error === null || !(property in error)) return "";
  const value = (error as Record<string, unknown>)[property];
  return value === undefined || value === null ? "" : String(value);
}
