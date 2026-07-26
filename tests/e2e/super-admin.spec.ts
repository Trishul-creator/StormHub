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
    await expect(page.getByRole("heading", { name: /platform admin/i })).toBeVisible();
    await expect(page.getByText(/School 1/i).first()).toBeVisible();
    await expect(page.getByText(/School 2/i).first()).toBeVisible();
    await expect(page.getByText(/Workspace URL name/i)).toBeVisible();
    await expect(page.getByText(/^Slug$/)).toHaveCount(0);
    const adminNavigation = page.getByRole("navigation", { name: "Administration" });
    await expect(adminNavigation).toBeVisible();
    await expect(adminNavigation.getByRole("link", { name: "Schools" })).toHaveAttribute("aria-current", "page");
    await expect(adminNavigation.getByRole("link", { name: "Statistics" })).toBeVisible();

    await adminNavigation.getByRole("link", { name: /support inbox/i }).click();
    await expect(page).toHaveURL(/\/admin\/feedback/);
    await expect(page.getByRole("heading", { name: /support inbox/i })).toBeVisible();

    await page.goto("/admin/schools");

    await page.goto("/admin/schools/school1");
    await expect(page).toHaveURL(/\/admin\/schools\/school1/);
    await expect(page.getByText(/Platform Admin Mode/i)).toBeVisible();
    await expect(page.getByRole("link", { name: /draft club catalog/i })).toBeVisible();

    await page.goto("/admin/schools/school2");
    await expect(page).toHaveURL(/\/admin\/schools\/school2/);
    await expect(page.getByText(/Platform Admin Mode/i)).toBeVisible();
    await expect(page.getByRole("button", { name: /join club/i })).toHaveCount(0);
  });
});
