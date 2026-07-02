import { expect, test, type Page } from "@playwright/test";

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

export async function signIn(page: Page, role: E2ERole) {
  const credentials = credentialsFor(role);
  if (!credentials) throw new Error(`Missing E2E credentials for ${role}.`);
  await page.goto("/auth/sign-in");
  await page.getByLabel(/email/i).fill(credentials.email);
  await page.getByLabel(/password/i).fill(credentials.password);
  await page.getByRole("button", { name: /sign in/i }).click();
  await expect(page).not.toHaveURL(/\/auth\/sign-in/);
}
