import { expect, test } from "@playwright/test";

test.describe("public school workspace separation", () => {
  test("school workspace routes load independently", async ({ page }) => {
    await page.goto("/s/school1");
    await expect(page.getByRole("heading", { name: /School 1/i })).toBeVisible();

    await page.goto("/s/school2");
    await expect(page.getByRole("heading", { name: /School 2/i })).toBeVisible();
  });

  test("school-scoped club and calendar routes are available", async ({ page }) => {
    await page.goto("/s/school1/clubs");
    await expect(page).toHaveURL(/\/s\/school1\/clubs/);

    await page.goto("/s/school2/calendar");
    await expect(page).toHaveURL(/\/s\/school2\/calendar/);
    await expect(page.getByRole("heading", { name: /calendar/i })).toBeVisible();
  });

  test("global discovery pages expose a school selector", async ({ page }) => {
    await page.goto("/calendar");
    await expect(page.getByLabel("School")).toBeVisible();

    await page.goto("/clubs");
    await expect(page.getByLabel("School")).toBeVisible();

    await page.goto("/opportunities");
    await expect(page.getByLabel("School")).toBeVisible();
  });
});
