import { expect, test } from "@playwright/test";

test.describe("public school workspace separation", () => {
  test("school workspace routes load independently", async ({ page }) => {
    await page.goto("/s/elkhorn-south");
    await expect(page.getByRole("heading", { name: /Elkhorn South/i })).toBeVisible();

    await page.goto("/s/elkhorn-north");
    await expect(page.getByRole("heading", { name: /Elkhorn North/i })).toBeVisible();
  });

  test("school-scoped club and calendar routes are available", async ({ page }) => {
    await page.goto("/s/elkhorn-south/clubs");
    await expect(page).toHaveURL(/\/s\/elkhorn-south\/clubs/);

    await page.goto("/s/elkhorn-north/calendar");
    await expect(page).toHaveURL(/\/s\/elkhorn-north\/calendar/);
    await expect(page.getByRole("heading", { name: /calendar/i })).toBeVisible();
  });
});
