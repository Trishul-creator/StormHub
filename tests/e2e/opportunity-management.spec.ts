import { expect, test } from "@playwright/test";
import { signIn, skipWithoutCredentials } from "./helpers";

test.describe("scoped opportunity management", () => {
  test("school admins see their complete inventory and cannot switch schools by URL", async ({ page }) => {
    skipWithoutCredentials("admin");
    await signIn(page, "admin");

    await page.goto("/manage/opportunities");
    await expect(page.getByRole("heading", { level: 1, name: /school 1 opportunities/i })).toBeVisible();
    await expect(page.getByRole("heading", { name: /existing opportunities/i })).toBeVisible();
    await expect(page.locator('[data-tour="opportunity-management"]')).toBeVisible();

    await page.goto("/admin/schools/school2/opportunities");
    await expect(page).not.toHaveURL(/\/admin\/schools\/school2\/opportunities/);
    await expect(page).toHaveURL(/\/admin(?:\?|$)/);
  });

  test("platform admins use an explicit school workspace", async ({ page }) => {
    skipWithoutCredentials("super_admin");
    await signIn(page, "super_admin");

    await page.goto("/admin/schools/school1/opportunities");
    await expect(page.getByRole("heading", { level: 1, name: /school 1 opportunities/i })).toBeVisible();
    await expect(page.locator('[data-tour="opportunity-management"]')).toBeVisible();
    await expect(page.getByRole("link", { name: /preview student view/i })).toHaveAttribute(
      "href",
      "/s/school1/opportunities"
    );
  });
});
