import { NextRequest, NextResponse } from "next/server";
import { verifyAuthToken } from "@/lib/firebase/auth";
import { adminDb } from "@/lib/firebase/admin";

/** Free tier: ~150,000 tokens/month ≈ 60 questions */
const FREE_TOKEN_BUDGET = 150_000;
/** Pro: 1,500,000 tokens/month */
const PRO_TOKEN_BUDGET = 1_500_000;
/** Premium: 3,000,000 tokens/month */
const PREMIUM_TOKEN_BUDGET = 3_000_000;

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
  const userDoc = await userRef.get();

  if (!userDoc.exists) {
    return NextResponse.json({ error: "user_not_found" }, { status: 404 });
  }

  const userData = userDoc.data() as Record<string, unknown>;
  const tier = (userData.tier as string) ?? "free";

  // Read streak fields directly — streak is only incremented when the user
  // actually sends a chat message (POST /api/chat), not on every page load.
  const streak = {
    currentStreak: (userData.currentStreak as number) ?? 0,
    longestStreak: (userData.longestStreak as number) ?? 0,
    lastActiveDate: (userData.lastActiveDate as string) ?? null,
    streakFreeze: (userData.streakFreeze as boolean) ?? false,
  };

  // Get current month usage
  const now = new Date();
  const yearMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  const usageDoc = await userRef.collection("usage").doc(yearMonth).get();

  const usageData = usageDoc.exists
    ? (usageDoc.data() as Record<string, number>)
    : { inputTokens: 0, outputTokens: 0, queryCount: 0 };

  const tokensUsed =
    (usageData.inputTokens ?? 0) + (usageData.outputTokens ?? 0);
  const tokenBudget = getBudgetForTier(tier);
  const budgetPercentUsed = Math.min(
    100,
    Math.round((tokensUsed / tokenBudget) * 100),
  );

  return NextResponse.json({
    user: {
      uid: decoded.uid,
      email: userData.email ?? null,
      displayName: userData.displayName ?? null,
      tier,
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
      queriesCount: usageData.queryCount ?? 0,
      budgetPercentUsed,
    },
  });
}
