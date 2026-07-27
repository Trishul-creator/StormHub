import { expect, test } from "@playwright/test";
import { signIn, skipWithoutCredentials } from "./helpers";

test.describe("teacher opportunity access", () => {
  test.beforeEach(() => {
    skipWithoutCredentials("teacher");
  });

  test("teacher can browse school opportunities without participation or management controls", async ({ page }) => {
    await signIn(page, "teacher");

    const opportunityLink = page
      .locator("header nav")
      .first()
      .getByRole("link", { name: /^opportunities$/i });
    await expect(opportunityLink).toBeVisible();
    await opportunityLink.click();

    await expect(page).toHaveURL(/\/s\/[^/]+\/opportunities/);
    await expect(
      page.getByRole("heading", { level: 1, name: /opportunities/i })
    ).toBeVisible();
    await expect(page.getByText(/read-only mode/i)).toBeVisible();
    await expect(page.getByRole("link", { name: /create opportunity/i })).toHaveCount(0);
    await expect(
      page.getByRole("button", { name: /save|apply|sign up|rsvp/i })
    ).toHaveCount(0);
  });
});
