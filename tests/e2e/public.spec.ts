import { expect, test } from "@playwright/test";

test.describe("public platform surfaces", () => {
  test("root landing page is platform-neutral and exposes sign-in", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByRole("heading", { name: /club discovery and opportunity management/i })).toBeVisible();
    await expect(page.getByText(/multi-school|school communities|school workspaces/i).first()).toBeVisible();
    if ((page.viewportSize()?.width ?? 1280) < 1024) {
      await page.getByRole("button", { name: /toggle menu/i }).click();
    }
    await expect(page.getByRole("banner").getByRole("link", { name: /^sign in$/i })).toBeVisible();
    await expect(page.getByRole("link", { name: /volunteering/i })).toHaveCount(0);
    await expect(page.getByRole("link", { name: /service hours/i })).toHaveCount(0);
    await expect(page.getByRole("link", { name: /^workshops$/i })).toHaveCount(0);
  });

  test("contact/support page shows the support email", async ({ page }) => {
    await page.goto("/contact");
    await expect(page.getByRole("link", { name: "stormhubsupport@gmail.com" })).toBeVisible();
  });

  test("public responses include security headers and hide framework details", async ({ request }) => {
    const response = await request.get("/");
    expect(response.headers()["content-security-policy"]).toContain("frame-ancestors 'none'");
    expect(response.headers()["x-content-type-options"]).toBe("nosniff");
    expect(response.headers()["x-frame-options"]).toBe("DENY");
    expect(response.headers()["referrer-policy"]).toBe("strict-origin-when-cross-origin");
    expect(response.headers()["permissions-policy"]).toContain("camera=()");
    expect(response.headers()["x-powered-by"]).toBeUndefined();
  });

  test("scheduled jobs reject unauthenticated requests", async ({ request }) => {
    for (const path of ["/api/cron/weekly-digest", "/api/cron/publish-scheduled"]) {
      const response = await request.get(path);
      expect(response.status()).toBe(401);
    }
  });
});
