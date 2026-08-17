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

  test("language selection updates immediately and persists", async ({ page }) => {
    await page.goto("/");
    if ((page.viewportSize()?.width ?? 1280) < 1024) {
      await page.getByRole("button", { name: /toggle menu/i }).click();
    }

    await page.getByRole("combobox", { name: /change language/i }).selectOption("es");

    await expect(page.locator("html")).toHaveAttribute("lang", "es");
    await expect(page.getByRole("heading", {
      name: /descubrimiento de clubes y gestión de oportunidades/i,
    })).toBeVisible();

    await page.reload();
    await expect(page.locator("html")).toHaveAttribute("lang", "es");
    await expect(page.getByRole("heading", {
      name: /descubrimiento de clubes y gestión de oportunidades/i,
    })).toBeVisible();
  });

  test("language selection translates feature pages and supports right-to-left layout", async ({ page }) => {
    await page.context().addCookies([{
      name: "stormhub-locale",
      value: "fr",
      url: "http://127.0.0.1:3000",
      sameSite: "Lax",
    }]);
    await page.goto("/clubs");

    await expect(page.getByRole("heading", { name: "Répertoire des clubs" })).toBeVisible();
    await expect(page.locator("html")).toHaveAttribute("lang", "fr");
    await expect(page.locator("html")).toHaveAttribute("dir", "ltr");

    await page.context().addCookies([{
      name: "stormhub-locale",
      value: "ar",
      url: "http://127.0.0.1:3000",
      sameSite: "Lax",
    }]);
    await page.reload();
    await expect(page).toHaveTitle(/مركز فرص الطلاب/);
    await expect(page.locator("html")).toHaveAttribute("lang", "ar");
    await expect(page.locator("html")).toHaveAttribute("dir", "rtl");
    await expect(page.getByRole("heading", { name: "دليل الأندية" })).toBeVisible();

    await page.goto("about:blank");
    await page.context().addCookies([{
      name: "stormhub-locale",
      value: "de",
      url: "http://127.0.0.1:3000",
      sameSite: "Lax",
    }]);
    const germanPrivacyPage = await page.context().newPage();
    await germanPrivacyPage.goto("/privacy");
    await expect(germanPrivacyPage.getByRole("heading", { name: "Datenschutzerklärung für Studenten" })).toBeVisible();
    await expect(germanPrivacyPage.getByRole("heading", { name: "Umfang und Verantwortung" })).toBeVisible();
    await expect(germanPrivacyPage.getByText(/Logged-out visitors see fictional demonstration content/)).toHaveCount(0);
    await expect(germanPrivacyPage.locator("html")).toHaveAttribute("lang", "de");
    await expect(germanPrivacyPage.locator("html")).toHaveAttribute("dir", "ltr");

    const germanAboutPage = await page.context().newPage();
    await germanAboutPage.goto("/about");
    await expect(germanAboutPage.getByText("A student-built opportunity hub designed to help students find their next step.")).toHaveCount(0);
    const germanContactPage = await page.context().newPage();
    await germanContactPage.goto("/contact");
    await expect(germanContactPage.getByText("Share feedback, report issues, or suggest improvements for StormHub.")).toHaveCount(0);
    const germanSignupPage = await page.context().newPage();
    await germanSignupPage.goto("/auth/sign-up");
    await expect(germanSignupPage.getByRole("heading", { name: "StormHub beitreten" })).toBeVisible();
    const germanOpportunitiesPage = await page.context().newPage();
    await germanOpportunitiesPage.goto("/opportunities");
    await expect(germanOpportunitiesPage.getByText(/^(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec) \d{1,2}, \d{4}$/)).toHaveCount(0);
  });

  test("contact/support page shows the support email", async ({ page }) => {
    await page.goto("/contact");
    await expect(page.getByRole("link", { name: "stormhubsupport@gmail.com" })).toBeVisible();
  });

  test("sign in exposes password recovery", async ({ page }) => {
    await page.goto("/auth/sign-in");
    await page.getByRole("link", { name: "Forgot password?" }).click();
    await expect(page).toHaveURL(/\/auth\/forgot-password$/);
    await expect(page.getByRole("heading", { name: "Reset your password" })).toBeVisible();
  });

  test("signed-out visitors see only the fictional showcase catalog", async ({ page }) => {
    await page.goto("/clubs");
    await expect(page.getByText("You’re viewing fictional sample data")).toBeVisible();
    await expect(page.getByRole("heading", { name: "Club Directory" })).toBeVisible();
    await expect(page.getByText("Northstar High School (Demo)").first()).toBeVisible();
    await expect(page.getByText(/Elkhorn South/i)).toHaveCount(0);
    await expect(page.getByRole("link", { name: "Horizon Robotics Collective" })).toBeVisible();
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
    for (const path of [
      "/api/cron/weekly-digest",
      "/api/cron/publish-scheduled",
      "/api/cron/data-retention",
    ]) {
      const response = await request.get(path);
      expect(response.status()).toBe(401);
    }
  });

  test("public health reporting never exposes operational details", async ({ request }) => {
    const response = await request.get("/api/health");
    expect([200, 503]).toContain(response.status());

    const body = await response.json();
    expect(Object.keys(body).sort()).toEqual(["status", "timestamp"]);
    expect(["ok", "degraded"]).toContain(body.status);
    expect(body.checks).toBeUndefined();
  });
});
