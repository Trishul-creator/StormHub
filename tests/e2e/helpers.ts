import { expect, test, type Page } from "@playwright/test";
import {
  allowsMutatingE2E,
  emailSafetyMessage,
  hasSafeE2EEmailMode,
  mutationSafetyMessage,
} from "./safety";

export type E2ERole = "super_admin" | "student" | "admin" | "teacher";

const envKeys: Record<E2ERole, { email: string; password: string }> = {
  super_admin: { email: "E2E_SUPER_ADMIN_EMAIL", password: "E2E_SUPER_ADMIN_PASSWORD" },
  student: { email: "E2E_STUDENT_EMAIL", password: "E2E_STUDENT_PASSWORD" },
  admin: { email: "E2E_ADMIN_EMAIL", password: "E2E_ADMIN_PASSWORD" },
  teacher: { email: "E2E_TEACHER_EMAIL", password: "E2E_TEACHER_PASSWORD" },
};

export function credentialsFor(role: E2ERole) {
  const keys = envKeys[role];
  const email = process.env[keys.email];
  const password = process.env[keys.password];
  return email && password ? { email, password } : null;
}

export function skipWithoutCredentials(role: E2ERole) {
  const keys = envKeys[role];
  test.skip(!credentialsFor(role), `Set ${keys.email} and ${keys.password} to run ${role} E2E tests.`);
}

export function skipUnlessMutationsAreSafe() {
  test.skip(!allowsMutatingE2E(), mutationSafetyMessage());
}

export function skipUnlessEmailIsOutboxOnly() {
  test.skip(!hasSafeE2EEmailMode(), emailSafetyMessage());
}

export async function signIn(page: Page, role: E2ERole) {
  const credentials = credentialsFor(role);
  if (!credentials) throw new Error(`Missing E2E credentials for ${role}.`);
  await page.goto("/auth/sign-in");
  await page.getByLabel(/email/i).fill(credentials.email);
  await page
    .getByRole("textbox", { name: "Password", exact: true })
    .fill(credentials.password);
  await page.getByRole("button", { name: /sign in/i }).click();

  const signInError = page
    .getByText(/sign in failed|invalid login|invalid credentials|email not confirmed|database not configured/i)
    .first();

  const result = await Promise.race([
    page
      .waitForURL((url) => !url.pathname.startsWith("/auth/sign-in"), { timeout: 20_000 })
      .then(() => "signed-in" as const)
      .catch(() => null),
    signInError
      .waitFor({ state: "visible", timeout: 20_000 })
      .then(() => "error" as const)
      .catch(() => null),
  ]);

  if (result === "error") {
    const errorText = (await signInError.textContent())?.trim() || "Unknown sign-in error.";
    throw new Error(`E2E sign-in failed for ${role}: ${errorText}`);
  }

  if (result !== "signed-in") {
    const visibleError = await signInError.isVisible().catch(() => false);
    const errorText = visibleError ? (await signInError.textContent())?.trim() : "";
    throw new Error(
      `E2E sign-in did not leave /auth/sign-in for ${role}.${errorText ? ` Visible error: ${errorText}` : ""}`
    );
  }

  await page.waitForLoadState("networkidle", { timeout: 10_000 }).catch(() => undefined);
  await expect(page).not.toHaveURL(/\/auth\/sign-in/, { timeout: 10_000 });
}
