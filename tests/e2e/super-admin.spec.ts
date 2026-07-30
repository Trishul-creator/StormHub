import { expect, test } from "@playwright/test";
import { signIn, skipWithoutCredentials } from "./helpers";

test.describe("super admin district chooser", () => {
  test.beforeEach(() => {
    skipWithoutCredentials("super_admin");
  });

  test("super admin lands on the platform hierarchy and can open school workspaces", async ({ page }) => {
    test.setTimeout(45_000);
    await signIn(page, "super_admin");
    await page.goto("/admin/districts");
    await expect(page).toHaveURL(/\/admin\/districts/);
    await expect(page.getByRole("heading", { name: "Districts", exact: true })).toBeVisible();
    const adminNavigation = page.getByRole("navigation", { name: "Administration" });
    await expect(adminNavigation).toBeVisible();
    await expect(adminNavigation.getByRole("link", { name: "Districts" })).toHaveAttribute("aria-current", "page");
    await expect(adminNavigation.getByRole("link", { name: "Statistics" })).toBeVisible();

    const hasDistrictSchema = await page.getByText(/Northstar Staging District/i).count() > 0;
    if (hasDistrictSchema) {
      await page.locator("summary").filter({ hasText: "Create district" }).click();
      await expect(page.getByText(/District name/i)).toBeVisible();
      await page.goto("/admin/districts/northstar-staging-district");
      await expect(page.getByText(/School 1/i).first()).toBeVisible();
      await expect(page.getByText(/School 2/i).first()).toBeVisible();
      await page.locator("summary").filter({ hasText: "Create school" }).click();
      await expect(page.getByLabel("Workspace URL name (optional)")).toBeVisible();
      await expect(page.getByText(/^Slug$/)).toHaveCount(0);
    } else {
      await expect(page.getByText(/District migration required/i)).toBeVisible();
      await expect(page.getByText(/School 1/i).first()).toBeVisible();
      await expect(page.getByText(/School 2/i).first()).toBeVisible();
    }

    await expect(
      adminNavigation.getByRole("link", { name: /support inbox/i })
    ).toHaveAttribute("href", "/admin/feedback");
    await page.goto("/admin/feedback");
    await expect(page).toHaveURL(/\/admin\/feedback/);
    await expect(page.getByRole("heading", { name: /support inbox/i })).toBeVisible();

    await page.goto("/admin/schools/school1");
    await expect(page).toHaveURL(/\/admin\/schools\/school1/);
    await expect(page.getByText(/Platform Admin Mode/i)).toBeVisible();
    await expect(page.getByRole("link", { name: /inspect club drafts/i })).toHaveAttribute(
      "href",
      "/admin/schools/school1/drafts"
    );
    await expect(page.getByRole("link", { name: /add clubs/i })).toHaveCount(0);

    await page.goto("/admin/schools/school2");
    await expect(page).toHaveURL(/\/admin\/schools\/school2/);
    await expect(page.getByText(/Platform Admin Mode/i)).toBeVisible();
    await expect(page.getByRole("button", { name: /join club/i })).toHaveCount(0);
  });

  test("platform user inventory filters immediately and exposes scoped account controls", async ({ page }) => {
    await signIn(page, "super_admin");
    await page.goto("/admin/users");

    await expect(page.getByRole("heading", { name: "Users & Roles" })).toBeVisible();
    await expect(page.getByRole("button", { name: /apply filters/i })).toHaveCount(0);

    await page.getByLabel("Role").selectOption("teacher");
    await expect(page).toHaveURL(/\/admin\/users\?role=teacher/, { timeout: 15_000 });

    const accountActions = page.getByRole("button", { name: /account actions for/i }).first();
    await expect(accountActions).toBeVisible();
    await accountActions.click();
    await expect(page.getByRole("menuitem", { name: /ban account|restore account/i })).toBeVisible();
    await expect(page.getByRole("menuitem", { name: "Delete user" })).toBeVisible();
  });
});
