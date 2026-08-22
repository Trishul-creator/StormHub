import { expect, test } from "@playwright/test";
import { signIn, skipWithoutCredentials } from "./helpers";

test.describe("teacher opportunity access", () => {
  test.beforeEach(() => {
    skipWithoutCredentials("teacher");
  });

  test("teacher can browse and submit opportunities without participation or publishing controls", async ({ page }) => {
    await signIn(page, "teacher");

    const opportunityLink = page
      .locator("header nav")
      .first()
      .getByRole("link", { name: /^opportunities$/i });
    await expect(opportunityLink).toBeVisible();
    await expect(opportunityLink).toHaveAttribute("href", /\/s\/[^/]+\/opportunities/);
    await Promise.all([
      page.waitForURL(/\/s\/[^/]+\/opportunities/),
      opportunityLink.click(),
    ]);
    await expect(
      page.getByRole("heading", { level: 1, name: /opportunities/i })
    ).toBeVisible();
    await expect(page.getByRole("link", { name: /add opportunity/i })).toBeVisible();
    await expect(
      page.getByRole("button", { name: /save|apply|sign up|rsvp/i })
    ).toHaveCount(0);

    await page.getByRole("link", { name: /add opportunity/i }).click();
    await expect(page).toHaveURL(/\/manage\/opportunities/);
    await expect(page.getByText(/sent to your school administrator for approval/i)).toBeVisible();
    await expect(page.getByRole("heading", { name: /create an opportunity/i })).toBeVisible();
    await expect(page.getByRole("button", { name: /^publish$/i })).toHaveCount(0);
  });
});
