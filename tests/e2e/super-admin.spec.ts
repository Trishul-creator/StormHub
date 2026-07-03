import { expect, test } from "@playwright/test";
import { signIn, skipWithoutCredentials } from "./helpers";

test.describe("super admin school chooser", () => {
  test.beforeEach(() => {
    skipWithoutCredentials("super_admin");
  });

  test("super admin lands on platform school chooser and can open school workspaces", async ({ page }) => {
    await signIn(page, "super_admin");
    await page.goto("/admin/schools");
    await expect(page).toHaveURL(/\/admin\/schools/);
    await expect(page.getByText(/School 1/i).first()).toBeVisible();
    await expect(page.getByText(/School 2/i).first()).toBeVisible();

    await page.goto("/admin/schools/school1");
    await expect(page.getByText(/Platform Admin Mode/i)).toBeVisible();
    await expect(page.getByRole("link", { name: /draft club catalog/i })).toBeVisible();

    await page.goto("/admin/schools/school2");
    await expect(page.getByText(/Platform Admin Mode/i)).toBeVisible();
    await expect(page.getByRole("button", { name: /join club/i })).toHaveCount(0);
  });
});
