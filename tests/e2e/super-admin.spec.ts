import { expect, test } from "@playwright/test";
import { signIn, skipWithoutCredentials } from "./helpers";

test.describe("super admin district chooser", () => {
  test.beforeEach(() => {
    skipWithoutCredentials("super_admin");
  });

  test("super admin lands on the platform hierarchy and can open school workspaces", async ({ page }) => {
    await signIn(page, "super_admin");
    await page.goto("/admin/districts");
    await expect(page).toHaveURL(/\/admin\/districts/);
    await expect(page.getByRole("heading", { name: "Districts", exact: true })).toBeVisible();
    await expect(page.getByText(/Northstar Staging District/i).first()).toBeVisible();
    await page.locator("summary").filter({ hasText: "Create district" }).click();
    await expect(page.getByText(/District name/i)).toBeVisible();
    const adminNavigation = page.getByRole("navigation", { name: "Administration" });
    await expect(adminNavigation).toBeVisible();
    await expect(adminNavigation.getByRole("link", { name: "Districts" })).toHaveAttribute("aria-current", "page");
    await expect(adminNavigation.getByRole("link", { name: "Statistics" })).toBeVisible();

    await page.goto("/admin/districts/northstar-staging-district");
    await expect(page.getByText(/School 1/i).first()).toBeVisible();
    await expect(page.getByText(/School 2/i).first()).toBeVisible();
    await page.locator("summary").filter({ hasText: "Create school" }).click();
    await expect(page.getByText(/Workspace URL name/i)).toBeVisible();
    await expect(page.getByText(/^Slug$/)).toHaveCount(0);

    await adminNavigation.getByRole("link", { name: /support inbox/i }).click();
    await expect(page).toHaveURL(/\/admin\/feedback/);
    await expect(page.getByRole("heading", { name: /support inbox/i })).toBeVisible();

    await page.goto("/admin/districts");

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
