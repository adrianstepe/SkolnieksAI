/**
 * Quiz Me flow — E2E tests.
 *
 * Prerequisites:
 *  - Dev server running on localhost:3000
 *  - Seeded premium test account (npm run seed)
 *  - NEXT_PUBLIC_QUIZ_ENABLED=true
 *
 * These tests use real Firebase Auth via form login (no mocking).
 * They assert the UI flow only — not answer correctness.
 */
import { test, expect, type Page } from "@playwright/test";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const PREMIUM_EMAIL = "test-premium@skolnieks.dev";
const PREMIUM_PASSWORD = "TestPremium123!";

async function loginAsPremium(page: Page) {
  await page.goto("/login");
  await page.locator("#email").fill(PREMIUM_EMAIL);
  await page.locator("#password").fill(PREMIUM_PASSWORD);
  await page.getByRole("button", { name: /Ienākt/i }).click();
  // Wait until redirected away from /login (dashboard load)
  await page.waitForURL((url) => !url.pathname.includes("/login"), {
    timeout: 15_000,
  });
}

/** Send a chat message and wait for an assistant response bubble. */
async function sendMessageAndWaitForResponse(page: Page, message: string) {
  const input = page.getByRole("textbox", { name: /rakstiet savu jautājumu/i }).or(
    page.locator("textarea, input[type='text']").last()
  );
  await input.fill(message);
  await input.press("Enter");

  // Wait for at least one assistant message to finish streaming.
  // The assistant bubble has role="article" or a data-role attr; we look for
  // the "Pārbaudi mani" button or the AI label to confirm the response landed.
  await page.waitForSelector('[aria-label="Sākt pašpārbaudi"]', {
    timeout: 30_000,
  });
}

/** Answer one question regardless of its type. */
async function answerCurrentQuestion(page: Page) {
  const panel = page.getByRole("region", { name: "Pašpārbaudes viktorīna" });

  // Multiple choice: click the first radio option
  const firstChoice = panel.getByRole("radio").first();
  const openInput = panel.locator("input[type='text']");

  if (await firstChoice.isVisible({ timeout: 2_000 }).catch(() => false)) {
    await firstChoice.click();
  } else {
    // Open-ended
    await openInput.fill("Es nezinu");
    await panel.getByRole("button", { name: "Pārbaudīt" }).click();
  }

  // Wait for the feedback + advance button to appear
  const advanceBtn = panel.getByRole("button", { name: /Nākamais|Redzēt rezultātu/i });
  await advanceBtn.waitFor({ timeout: 15_000 });
  await advanceBtn.click();
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

test.describe("Quiz Me flow", () => {
  test("full quiz flow — desktop", async ({ page }) => {
    await loginAsPremium(page);
    await sendMessageAndWaitForResponse(page, "Paskaidro Pitagora teorēmu");

    // Step 4: "Pārbaudi mani" button visible
    const quizBtn = page.getByRole("button", { name: "Sākt pašpārbaudi" });
    await expect(quizBtn).toBeVisible();

    // Step 5: Click → quiz panel opens
    await quizBtn.click();
    const panel = page.getByRole("region", { name: "Pašpārbaudes viktorīna" });
    await expect(panel).toBeVisible({ timeout: 10_000 });

    // Step 6: Answer all questions (up to 5)
    for (let i = 0; i < 5; i++) {
      const stillAnswering = await panel
        .getByRole("radio")
        .or(panel.locator("input[type='text']"))
        .first()
        .isVisible({ timeout: 3_000 })
        .catch(() => false);
      if (!stillAnswering) break;
      await answerCurrentQuestion(page);
    }

    // Step 7: Result screen shows "X/5"
    await expect(panel.getByText(/\d\/\d/)).toBeVisible({ timeout: 5_000 });

    // Step 8: Close button dismisses the panel
    await panel.getByRole("button", { name: "Aizvērt" }).click();
    await expect(panel).not.toBeVisible();
  });

  test("full quiz flow — mobile 375×812", async ({ browser }) => {
    const ctx = await browser.newContext({
      viewport: { width: 375, height: 812 },
    });
    const page = await ctx.newPage();

    await loginAsPremium(page);
    await sendMessageAndWaitForResponse(page, "Paskaidro Pitagora teorēmu");

    const quizBtn = page.getByRole("button", { name: "Sākt pašpārbaudi" });
    await expect(quizBtn).toBeVisible();
    await quizBtn.click();

    const panel = page.getByRole("region", { name: "Pašpārbaudes viktorīna" });
    await expect(panel).toBeVisible({ timeout: 10_000 });

    for (let i = 0; i < 5; i++) {
      const stillAnswering = await panel
        .getByRole("radio")
        .or(panel.locator("input[type='text']"))
        .first()
        .isVisible({ timeout: 3_000 })
        .catch(() => false);
      if (!stillAnswering) break;
      await answerCurrentQuestion(page);
    }

    await expect(panel.getByText(/\d\/\d/)).toBeVisible({ timeout: 5_000 });

    await panel.getByRole("button", { name: "Aizvērt" }).click();
    await expect(panel).not.toBeVisible();

    await ctx.close();
  });
});
