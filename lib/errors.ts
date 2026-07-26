/** Map Supabase/Postgres errors to user-friendly messages. */
export function friendlyError(error: unknown, fallback = "Something went wrong. Please try again."): string {
  if (!error) return fallback;
  const msg = error instanceof Error ? error.message : String(error);
  const code = typeof error === "object" && error !== null && "code" in error ? String((error as { code: string }).code) : "";

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

export class SetupRequiredError extends Error {
  constructor() {
    super("SETUP_REQUIRED");
    this.name = "SetupRequiredError";
  }
}

export function isSetupRequired(error: unknown): boolean {
  if (error instanceof SetupRequiredError) return true;
  const msg = error instanceof Error ? error.message : String(error);
  return msg.includes("does not exist") || msg.includes("SETUP_REQUIRED");
}
