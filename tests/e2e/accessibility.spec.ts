import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

const publicPages = ["/", "/clubs", "/calendar", "/opportunities", "/auth/sign-in", "/contact"];

for (const path of publicPages) {
  test(`${path} has no serious automated accessibility violations`, async ({ page }) => {
    await page.goto(path);
    await expect(page.locator("body")).toBeVisible();
    const results = await new AxeBuilder({ page }).analyze();
    const serious = results.violations.filter((violation) => violation.impact === "serious" || violation.impact === "critical");
    expect(serious, JSON.stringify(serious, null, 2)).toEqual([]);
  });
}

for (const path of ["/", "/clubs", "/opportunities"]) {
  test(`${path} keeps accessible contrast in dark mode`, async ({ page }) => {
    await page.addInitScript(() => {
      window.localStorage.setItem("stormhub-theme", "dark");
    });
    await page.goto(path);
    await expect(page.locator("html")).toHaveClass(/dark/);
    const results = await new AxeBuilder({ page }).analyze();
    const serious = results.violations.filter(
      (violation) => violation.impact === "serious" || violation.impact === "critical"
    );
    expect(serious, `${path}\n${JSON.stringify(serious, null, 2)}`).toEqual([]);
  });
}

test("primary navigation and sign-in are keyboard reachable", async ({ page }, testInfo) => {
  test.skip(
    testInfo.project.name === "webkit" || testInfo.project.name === "mobile-safari",
    "Safari requires the operating system Full Keyboard Access setting; validate it on the physical-device checklist."
  );
  await page.goto("/");
  await page.keyboard.press("Tab");
  await expect(page.locator(":focus")).toBeVisible();
  for (let index = 0; index < 12; index += 1) {
    const focusedText = await page.locator(":focus").getAttribute("href");
    if (focusedText === "/auth/sign-in") break;
    await page.keyboard.press("Tab");
  }
  await expect(page.locator(":focus")).toHaveAttribute("href", "/auth/sign-in");
});
