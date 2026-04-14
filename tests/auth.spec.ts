/**
 * Auth flow tests — form validation and navigation.
 * Tests run client-side only (no real Firebase calls).
 * Firebase errors are expected; what we test is the UI's response to them.
 */
import { test, expect } from "@playwright/test";

test.describe("Signup page", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/signup");
  });

  test("renders birth year selector, email, and password fields", async ({ page }) => {
    await expect(page.getByText("Dzimšanas gads")).toBeVisible();
    await expect(page.locator("#email")).toBeVisible();
    await expect(page.locator("#password")).toBeVisible();
    await expect(page.locator("#password-confirm")).toBeVisible();
  });

  test("requires birth year before submitting", async ({ page }) => {
    await page.locator("#email").fill("test@example.com");
    await page.locator("#password").fill("securepass");
    await page.locator("#password-confirm").fill("securepass");
    await page.locator("#signup-submit").click();

    // Latvian validation message should appear
    await expect(page.getByText("Lūdzu izvēlies savu dzimšanas gadu")).toBeVisible();
  });

  test("shows error when passwords do not match", async ({ page }) => {
    // Select a birth year (2005 → age ~20, no parental consent needed)
    await page.getByRole("button", { name: /Izvēlies gadu/i }).click();
    await page.getByRole("button", { name: "2005" }).click();

    await page.locator("#email").fill("test@example.com");
    await page.locator("#password").fill("password1");
    await page.locator("#password-confirm").fill("password2");
    await page.locator("#signup-submit").click();

    await expect(page.getByText("Paroles nesakrīt")).toBeVisible();
  });

  test("shows error when password is too short", async ({ page }) => {
    await page.getByRole("button", { name: /Izvēlies gadu/i }).click();
    await page.getByRole("button", { name: "2005" }).click();

    await page.locator("#email").fill("test@example.com");
    await page.locator("#password").fill("abc");
    await page.locator("#password-confirm").fill("abc");
    await page.locator("#signup-submit").click();

    await expect(page.getByText(/vismaz 6/i)).toBeVisible();
  });

  test("shows parental consent flow for under-13 birth years", async ({ page }) => {
    // 2013 → age ~12 (under 13)
    await page.getByRole("button", { name: /Izvēlies gadu/i }).click();
    await page.getByRole("button", { name: "2013" }).click();

    await page.locator("#email").fill("kid@example.com");
    await page.locator("#password").fill("securepass");
    await page.locator("#password-confirm").fill("securepass");
    await page.locator("#signup-submit").click();

    await expect(page.getByText("Vecāku atļauja nepieciešama")).toBeVisible();
    await expect(page.locator("#parent-email")).toBeVisible();
  });

  test("has working link to login page", async ({ page }) => {
    await page.getByRole("link", { name: /Ienākt/i }).click();
    await expect(page).toHaveURL(/\/login/);
  });

  test("terms and privacy links are present", async ({ page }) => {
    await expect(page.getByRole("link", { name: /Lietošanas noteikumiem/i })).toHaveAttribute(
      "href",
      "/terms"
    );
    await expect(page.getByRole("link", { name: /Privātuma politikai/i })).toHaveAttribute(
      "href",
      "/privacy"
    );
  });
});

test.describe("Login page", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/login");
  });

  test("renders email and password fields", async ({ page }) => {
    await expect(page.locator("#email")).toBeVisible();
    await expect(page.locator("#password")).toBeVisible();
  });

  test("has working link to signup page", async ({ page }) => {
    await page.getByRole("link", { name: /Reģistrēties/i }).click();
    await expect(page).toHaveURL(/\/signup/);
  });

  test("has working forgot password link", async ({ page }) => {
    await page.getByRole("link", { name: /Aizmirsi paroli/i }).click();
    await expect(page).toHaveURL(/\/forgot-password/);
  });
});
