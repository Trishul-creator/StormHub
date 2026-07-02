import { expect, test } from "@playwright/test";

test.describe("public platform surfaces", () => {
  test("root landing page is platform-neutral and exposes sign-in", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByRole("heading", { name: /club discovery and opportunity management/i })).toBeVisible();
    await expect(page.getByText(/multi-school|school communities|school workspaces/i).first()).toBeVisible();
    await expect(page.getByRole("banner").getByRole("link", { name: /^sign in$/i })).toBeVisible();
    await expect(page.getByRole("link", { name: /volunteering/i })).toHaveCount(0);
    await expect(page.getByRole("link", { name: /service hours/i })).toHaveCount(0);
    await expect(page.getByRole("link", { name: /^workshops$/i })).toHaveCount(0);
  });

  test("contact/support page shows the support email", async ({ page }) => {
    await page.goto("/contact");
    await expect(page.getByRole("link", { name: "stormhubsupport@gmail.com" })).toBeVisible();
  });
});
