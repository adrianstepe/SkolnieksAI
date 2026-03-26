import { adminDb } from "./admin";

// ---------------------------------------------------------------------------
// Streak field shape — mirrors the users/{uid} Firestore document fields.
// ---------------------------------------------------------------------------

export interface StreakFields {
  currentStreak: number;
  longestStreak: number;
  lastActiveDate: string | null; // YYYY-MM-DD UTC calendar date
  streakFreeze: boolean;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Returns today's date as a YYYY-MM-DD string in UTC. */
function todayUTC(): string {
  return new Date().toISOString().slice(0, 10);
}

/**
 * Difference in whole calendar days between two YYYY-MM-DD strings.
 * Positive when `b` is after `a`.
 */
function calendarDaysDiff(a: string, b: string): number {
  const msPerDay = 86_400_000;
  return Math.round(
    (new Date(b).getTime() - new Date(a).getTime()) / msPerDay,
  );
}

// ---------------------------------------------------------------------------
// Core function
// ---------------------------------------------------------------------------

/**
 * Evaluates and updates streak data for a user atomically in a Firestore
 * transaction. Safe to call on every authenticated request — it is a no-op
 * when the user was already active today.
 *
 * Rules:
 *  - First ever activity        → currentStreak = 1
 *  - Active again today         → no change
 *  - Exactly one calendar day   → increment currentStreak
 *  - More than one day gap:
 *      • streakFreeze true AND paid tier → consume freeze, preserve streak
 *      • otherwise                       → reset currentStreak to 1
 *  - longestStreak is updated whenever currentStreak exceeds it
 *
 * @param uid          Firebase user ID
 * @param isPaidTier   Whether the user is on a paid plan (freeze only works for paid)
 */
export async function evaluateAndUpdateStreak(
  uid: string,
  isPaidTier: boolean,
): Promise<StreakFields> {
  const userRef = adminDb.collection("users").doc(uid);
  const today = todayUTC();

  return adminDb.runTransaction(async (txn) => {
    const snap = await txn.get(userRef);
    if (!snap.exists) throw new Error("user_not_found");

    const data = snap.data() as Record<string, unknown>;

    const lastActiveDate = (data.lastActiveDate as string) ?? null;
    let currentStreak = (data.currentStreak as number) ?? 0;
    let longestStreak = (data.longestStreak as number) ?? 0;
    let streakFreeze = (data.streakFreeze as boolean) ?? false;

    // Already marked active today — nothing to update.
    if (lastActiveDate === today) {
      return { currentStreak, longestStreak, lastActiveDate, streakFreeze };
    }

    if (lastActiveDate === null) {
      // First ever recorded activity.
      currentStreak = 1;
    } else {
      const diff = calendarDaysDiff(lastActiveDate, today);

      if (diff === 1) {
        // Perfect consecutive day.
        currentStreak += 1;
      } else {
        // Gap of 2+ days.
        if (streakFreeze && isPaidTier) {
          // Freeze absorbs the missed day(s). Streak preserved, freeze spent.
          streakFreeze = false;
          // currentStreak intentionally unchanged — user picks up where they left off.
        } else {
          // No protection — streak resets. Today is day 1 of a new streak.
          currentStreak = 1;
        }
      }
    }

    if (currentStreak > longestStreak) {
      longestStreak = currentStreak;
    }

    txn.update(userRef, {
      currentStreak,
      longestStreak,
      lastActiveDate: today,
      streakFreeze,
    });

    return { currentStreak, longestStreak, lastActiveDate: today, streakFreeze };
  });
}

// ---------------------------------------------------------------------------
// Default streak values — used when initialising a new user document.
// ---------------------------------------------------------------------------

export const DEFAULT_STREAK_FIELDS: StreakFields = {
  currentStreak: 0,
  longestStreak: 0,
  lastActiveDate: null,
  streakFreeze: false,
};
