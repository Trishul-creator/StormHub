import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";
import { signIn, skipWithoutCredentials } from "./helpers";

test.describe("scoped admin statistics", () => {
  test("school admins stay locked to their assigned school", async ({ page }) => {
    skipWithoutCredentials("admin");
    await page.emulateMedia({ reducedMotion: "reduce" });
    await signIn(page, "admin");

    await page.goto("/admin/statistics?school=school2");

    await expect(page.getByRole("heading", { name: "Statistics", exact: true })).toBeVisible();
    await expect(page.getByText("Scope enforced")).toBeVisible();
    await expect(page.getByText(/School admins can only see aggregated data from their assigned school/i)).toBeVisible();
    await expect(page.getByLabel("View scope")).toHaveCount(0);

    const results = await new AxeBuilder({ page }).analyze();
    const serious = results.violations.filter(
      (violation) => violation.impact === "serious" || violation.impact === "critical",
    );
    expect(serious, JSON.stringify(serious, null, 2)).toEqual([]);
  });

  test("super admins can switch between platform and school scopes", async ({ page }) => {
    skipWithoutCredentials("super_admin");
    await signIn(page, "super_admin");

    await page.goto("/admin/statistics");

    await expect(page.getByRole("heading", { name: "Statistics", exact: true })).toBeVisible();
    await expect(page.getByLabel("View scope")).toBeVisible();
    await expect(page.getByText(/Platform totals combine every school workspace/i)).toBeVisible();

    await page.getByLabel("View scope").selectOption("school1");
    await page.getByRole("button", { name: "Apply" }).click();

    await expect(page).toHaveURL(/\/admin\/statistics\?school=school1/);
    await expect(page.getByText(/intentionally filtered to one school/i)).toBeVisible();
  });
});
