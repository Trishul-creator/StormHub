import { expect, test } from "@playwright/test";
import { signIn, skipWithoutCredentials } from "./helpers";

test.describe("student core flow", () => {
  test.beforeEach(() => {
    skipWithoutCredentials("student");
  });

  test("student signs in, reaches dashboard, and can browse school clubs", async ({ page }) => {
    await signIn(page, "student");
    await page.goto("/dashboard");
    await expect(page.getByRole("heading", { name: /dashboard/i })).toBeVisible();

    await page.locator("header nav").first().getByRole("link", { name: /^clubs$/i }).click();
    await expect(page).toHaveURL(/\/clubs|\/s\/[^/]+\/clubs/);
    await expect(page.getByRole("heading", { name: /clubs/i })).toBeVisible();

    await page.goto("/digest");
    await expect(page.getByRole("heading", { name: /weekly digest/i })).toBeVisible();
    await expect(page.getByRole("button", { name: /copy digest/i })).toBeVisible();
  });
});
