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
