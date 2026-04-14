/**
 * Smoke tests — every public page must load without JS errors.
 * Run against a live dev server: npm run dev, then npx playwright test
 * Or against a Vercel preview: PLAYWRIGHT_BASE_URL=https://... npx playwright test
 */
import { test, expect } from "@playwright/test";

const PUBLIC_PAGES = [
  { path: "/", titleFragment: "SkolnieksAI" },
  { path: "/login", titleFragment: "SkolnieksAI" },
  { path: "/signup", titleFragment: "SkolnieksAI" },
  { path: "/privacy", titleFragment: "SkolnieksAI" },
  { path: "/terms", titleFragment: "SkolnieksAI" },
];

for (const { path, titleFragment } of PUBLIC_PAGES) {
  test(`${path} loads without errors`, async ({ page }) => {
    const consoleErrors: string[] = [];
    page.on("console", (msg) => {
      if (msg.type() === "error") consoleErrors.push(msg.text());
    });

    const response = await page.goto(path);
    expect(response?.status()).toBeLessThan(400);
    await expect(page).toHaveTitle(new RegExp(titleFragment, "i"));

    // Filter out known third-party noise (Firebase analytics, Stripe)
    const realErrors = consoleErrors.filter(
      (e) =>
        !e.includes("firebaseapp.com") &&
        !e.includes("stripe.com") &&
        !e.includes("googletagmanager") &&
        !e.includes("google-analytics")
    );
    expect(realErrors).toHaveLength(0);
  });
}

test("health endpoint returns ok or degraded", async ({ request }) => {
  const res = await request.get("/api/health");
  expect([200, 503]).toContain(res.status());
  const body = await res.json() as { status: string; services: Record<string, string> };
  expect(["ok", "degraded"]).toContain(body.status);
  expect(body.services).toBeDefined();
});

test("sitemap.xml is reachable and lists /terms", async ({ request }) => {
  const res = await request.get("/sitemap.xml");
  expect(res.status()).toBe(200);
  const xml = await res.text();
  expect(xml).toContain("/terms");
  expect(xml).toContain("/privacy");
  expect(xml).toContain("/signup");
});
