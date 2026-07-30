export const ADMIN_REAUTHENTICATION_MAX_AGE_SECONDS = 5 * 60;
export const ADMIN_REAUTHENTICATION_REQUIRED =
  "Confirm your identity before making this sensitive administrative change.";

export type AdminReauthenticationFailure = {
  success: false;
  error: string;
  reauthRequired: true;
};

export function adminReauthenticationFailure(): AdminReauthenticationFailure {
  return {
    success: false,
    error: ADMIN_REAUTHENTICATION_REQUIRED,
    reauthRequired: true,
  };
}

export function needsAdminReauthentication(
  result: unknown
): boolean {
  return typeof result === "object"
    && result !== null
    && "reauthRequired" in result
    && (result as { reauthRequired?: unknown }).reauthRequired === true;
}

export function adminReauthenticationPath(next: string): string {
  return `/auth/confirm-admin?next=${encodeURIComponent(next)}`;
}

export function beginAdminReauthentication(): void {
  if (typeof window === "undefined") return;
  const next = `${window.location.pathname}${window.location.search}`;
  window.location.assign(adminReauthenticationPath(next));
}
