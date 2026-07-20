import { expect, test, type Page } from "@playwright/test";
import { createHmac } from "node:crypto";
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
  await page.getByLabel(/password/i).fill(credentials.password);
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

  if (role === "admin" || role === "super_admin") {
    await completeAdminMfa(page, role);
  }
}

async function completeAdminMfa(page: Page, role: "admin" | "super_admin") {
  const redirectTo = role === "super_admin" ? "/admin/schools" : "/admin";
  await page.goto(`/auth/mfa?redirect=${encodeURIComponent(redirectTo)}`);

  const setupButton = page.getByRole("button", { name: /set up authenticator/i });
  const codeInput = page.getByLabel(/six-digit code/i);
  await Promise.race([
    setupButton.waitFor({ state: "visible", timeout: 15_000 }).catch(() => undefined),
    codeInput.waitFor({ state: "visible", timeout: 15_000 }).catch(() => undefined),
    page.waitForURL((url) => url.pathname === redirectTo, { timeout: 15_000 }).catch(() => undefined),
  ]);
  if (new URL(page.url()).pathname === redirectTo) return;

  let secret = role === "super_admin"
    ? process.env.E2E_SUPER_ADMIN_TOTP_SECRET
    : process.env.E2E_ADMIN_TOTP_SECRET;
  if (await setupButton.isVisible().catch(() => false)) {
    await setupButton.click();
    const manualKey = page.getByText(/manual key:/i);
    await expect(manualKey).toBeVisible({ timeout: 10_000 });
    secret = (await manualKey.textContent())?.replace(/.*manual key:\s*/i, "").trim();
  }
  if (!secret) {
    throw new Error(`No TOTP secret is available for the ${role} E2E account. Run staging:setup to reset dedicated test factors.`);
  }

  await expect(codeInput).toBeVisible({ timeout: 10_000 });
  await codeInput.fill(generateTotp(secret));
  await page.getByRole("button", { name: /verify and continue/i }).click();
  await page.waitForURL((url) => url.pathname === redirectTo, { timeout: 20_000 });
}

function generateTotp(base32Secret: string, timestamp = Date.now()): string {
  const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
  const normalized = base32Secret.toUpperCase().replace(/[^A-Z2-7]/g, "");
  let bits = "";
  for (const character of normalized) {
    const value = alphabet.indexOf(character);
    if (value < 0) throw new Error("Invalid base32 TOTP secret.");
    bits += value.toString(2).padStart(5, "0");
  }
  const bytes = Buffer.alloc(Math.floor(bits.length / 8));
  for (let index = 0; index < bytes.length; index += 1) {
    bytes[index] = Number.parseInt(bits.slice(index * 8, index * 8 + 8), 2);
  }

  const counter = Buffer.alloc(8);
  counter.writeBigUInt64BE(BigInt(Math.floor(timestamp / 30_000)));
  const digest = createHmac("sha1", bytes).update(counter).digest();
  const offset = digest[digest.length - 1] & 0x0f;
  const binary = ((digest[offset] & 0x7f) << 24)
    | ((digest[offset + 1] & 0xff) << 16)
    | ((digest[offset + 2] & 0xff) << 8)
    | (digest[offset + 3] & 0xff);
  return String(binary % 1_000_000).padStart(6, "0");
}
