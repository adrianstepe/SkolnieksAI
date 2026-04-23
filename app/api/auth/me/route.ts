import { NextRequest, NextResponse } from "next/server";
import { verifyAuthToken } from "@/lib/firebase/auth";
import { adminDb } from "@/lib/firebase/admin";

/** Free tier: ~250,000 tokens/month ≈ 100 questions */
const FREE_TOKEN_BUDGET = 250_000;
/** Pro: 2,000,000 tokens/month */
const PRO_TOKEN_BUDGET = 2_000_000;
/** Premium: 4,000,000 tokens/month */
const PREMIUM_TOKEN_BUDGET = 4_000_000;

function getBudgetForTier(tier: string): number {
  switch (tier) {
    case "pro":
      return PRO_TOKEN_BUDGET;
    case "premium":
    case "school_pro":
      return PREMIUM_TOKEN_BUDGET;
    default:
      return FREE_TOKEN_BUDGET;
  }
}

export async function GET(request: NextRequest) {
  const decoded = await verifyAuthToken(request);
  if (!decoded) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const userRef = adminDb.collection("users").doc(decoded.uid);

  // Get current month usage — use UTC to stay consistent with chat/route.ts
  const todayISO = new Date().toISOString().slice(0, 10); // YYYY-MM-DD UTC
  const yearMonth = todayISO.slice(0, 7);                 // YYYY-MM

  // Fetch both documents concurrently to save time
  const [userDoc, usageDoc] = await Promise.all([
    userRef.get(),
    userRef.collection("usage").doc(yearMonth).get(),
  ]);

  if (!userDoc.exists) {
    return NextResponse.json({ error: "user_not_found" }, { status: 404 });
  }

  const userData = userDoc.data() as Record<string, unknown>;
  const tier = (userData.tier as string) ?? "free";

  const rawBillingInterval = userData.billingInterval;
  const billingInterval =
    rawBillingInterval === "annual" || rawBillingInterval === "monthly"
      ? rawBillingInterval
      : undefined;

  // Read streak fields directly — streak is only incremented when the user
  // actually sends a chat message (POST /api/chat), not on every page load.
  const streak = {
    currentStreak: (userData.currentStreak as number) ?? 0,
    longestStreak: (userData.longestStreak as number) ?? 0,
    lastActiveDate: (userData.lastActiveDate as string) ?? null,
    streakFreeze: (userData.streakFreeze as boolean) ?? false,
  };

  const usageData = usageDoc.exists
    ? (usageDoc.data() as Record<string, unknown>)
    : {} as Record<string, unknown>;

  const tokensUsed =
    ((usageData.inputTokens as number) ?? 0) + ((usageData.outputTokens as number) ?? 0);
  const tokenBudget = getBudgetForTier(tier);
  const budgetPercentUsed = Math.min(
    100,
    Math.round((tokensUsed / tokenBudget) * 100),
  );

  // Expose daily count and date so the client can compute questions remaining today
  // without having to know whether a UTC-day boundary has been crossed.
  const storedDailyDate = (usageData.dailyDate as string) ?? null;
  const dailyCount =
    storedDailyDate === todayISO ? ((usageData.dailyCount as number) ?? 0) : 0;

  return NextResponse.json({
    user: {
      uid: decoded.uid,
      email: userData.email ?? null,
      displayName: userData.displayName ?? null,
      tier,
      ...(billingInterval !== undefined ? { billingInterval } : {}),
      grade: userData.grade ?? null,
      onboardingComplete: userData.onboardingComplete === true,
      currentStreak: streak.currentStreak,
      longestStreak: streak.longestStreak,
      lastActiveDate: streak.lastActiveDate,
      streakFreeze: streak.streakFreeze,
    },
    usage: {
      tokensUsed,
      tokenBudget,
      queriesCount: (usageData.queryCount as number) ?? 0,
      budgetPercentUsed,
      dailyCount,
      dailyDate: todayISO,
    },
  });
}
