import { expect, test } from "@playwright/test";
import { signIn, skipWithoutCredentials } from "./helpers";

test.describe("public showcase separation", () => {
  test("requested school routes never reveal real school data before sign-in", async ({ page }) => {
    await page.goto("/s/school1");
    await expect(page.getByRole("heading", { name: /Northstar High School/i })).toBeVisible();
    await expect(page.getByText("You’re viewing fictional sample data")).toBeVisible();
    await expect(page.getByText(/School 1/i)).toHaveCount(0);

    await page.goto("/s/school2");
    await expect(page.getByRole("heading", { name: /Northstar High School/i })).toBeVisible();
    await expect(page.getByText("You’re viewing fictional sample data")).toBeVisible();
    await expect(page.getByText(/School 2/i)).toHaveCount(0);
  });

  test("school-shaped showcase routes remain navigable with fictional content", async ({ page }) => {
    await page.goto("/s/school1/clubs");
    await expect(page).toHaveURL(/\/s\/school1\/clubs/);
    await expect(page.getByRole("heading", { name: /Northstar Demo Clubs/i })).toBeVisible();

    await page.goto("/s/school2/calendar");
    await expect(page).toHaveURL(/\/s\/school2\/calendar/);
    await expect(page.getByRole("heading", { name: /Northstar Demo Calendar/i })).toBeVisible();
  });

  test("global discovery pages hide the real-school selector before sign-in", async ({ page }) => {
    for (const path of ["/calendar", "/clubs", "/opportunities"]) {
      await page.goto(path);
      await expect(page.getByText("You’re viewing fictional sample data")).toBeVisible();
      await expect(page.getByLabel("School")).toHaveCount(0);
    }
  });
});

test.describe("authenticated school workspace boundaries", () => {
  test("students cannot open another school by typing its URL", async ({ page }) => {
    skipWithoutCredentials("student");
    await signIn(page, "student");

    await page.goto("/s/school1/clubs");
    await expect(page.getByRole("heading", { name: /School 1 Clubs/i })).toBeVisible();

    const response = await page.goto("/s/school2/clubs");
    expect([200, 404]).toContain(response?.status());
    await expect(page.getByText(/School 2 Clubs/i)).toHaveCount(0);
    await expect(page.getByRole("heading", { name: "Page not found" })).toBeVisible();
  });
});
