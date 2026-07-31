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

    const response = await page.goto("/admin/schools/school2/opportunities");
    expect([200, 404]).toContain(response?.status());
    await expect(
      page.getByRole("heading", { level: 1, name: /school 2 opportunities/i })
    ).toHaveCount(0);
  });

  test("platform admins need an explicit audited support session", async ({ page }) => {
    skipWithoutCredentials("super_admin");
    await signIn(page, "super_admin");

    // Support sessions are intentionally durable and can outlive a browser
    // context. End any active session first so this access-gate assertion does
    // not depend on staging state left by another authorized support check.
    await page.goto("/admin/schools/school1#support-access");
    const endSupportAccess = page.getByRole("button", { name: /end access now/i });
    if (await endSupportAccess.isVisible().catch(() => false)) {
      await endSupportAccess.click();
      await expect(
        page.getByRole("button", { name: /start read-only support/i })
      ).toBeVisible({ timeout: 15_000 });
    }

    await page.goto("/admin/schools/school1/opportunities");
    await expect(page).toHaveURL(/\/admin\/schools\/school1#support-access$/);
    await expect(page.getByText(/Platform Admin Mode/i)).toBeVisible();
    await expect(page.locator('[data-tour="opportunity-management"]')).toHaveCount(0);
  });
});
