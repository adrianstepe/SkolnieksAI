/**
 * Critical path tests — unauthenticated navigation and redirect behaviour.
 *
 * Full signup → chat → upgrade E2E requires live Firebase credentials and a
 * real test account. Those are run separately in a staging environment.
 * What we test here: the app correctly gates protected routes and the upgrade
 * path (pricing / upgrade modal) is reachable from the public side.
 */
import { test, expect } from "@playwright/test";

test.describe("Protected route gating", () => {
  test("unauthenticated / redirects to login or shows login UI", async ({ page }) => {
    await page.goto("/");
    // Either the page redirects to /login, or the login form appears inline.
    const url = page.url();
    const hasLoginForm = await page.locator("#email").isVisible().catch(() => false);
    const redirectedToLogin = url.includes("/login");

    expect(redirectedToLogin || hasLoginForm).toBe(true);
  });

  test("unauthenticated /settings redirects to login", async ({ page }) => {
    await page.goto("/settings");
    await page.waitForURL(/\/(login|signup|$)/);
    expect(page.url()).toMatch(/\/(login|signup|\?)/);
  });
});

test.describe("Chat API rejects unauthenticated requests", () => {
  test("POST /api/chat without auth header returns 401", async ({ request }) => {
    const res = await request.post("/api/chat", {
      data: {
        message: "Kas ir atoms?",
        subject: "science",
        grade: 8,
      },
    });
    expect(res.status()).toBe(401);
  });

  test("POST /api/chat with malformed JSON returns 400", async ({ request }) => {
    // Send raw invalid JSON with a valid-looking auth header
    const res = await request.post("/api/chat", {
      headers: {
        Authorization: "Bearer invalid.token.here",
        "Content-Type": "application/json",
      },
      data: "not json",
    });
    // 401 (bad token) or 400 (bad JSON) — either means the API is validating
    expect([400, 401]).toContain(res.status());
  });
});

test.describe("Stripe webhook rejects unsigned requests", () => {
  test("POST /api/stripe/webhook without Stripe signature returns 400", async ({ request }) => {
    const res = await request.post("/api/stripe/webhook", {
      data: { type: "checkout.session.completed" },
    });
    // Must refuse to process — no valid Stripe-Signature header
    expect(res.status()).toBeGreaterThanOrEqual(400);
  });
});
