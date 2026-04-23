import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase/admin";
import { FieldValue } from "firebase-admin/firestore";
import type { QueryDocumentSnapshot, Query, DocumentData } from "firebase-admin/firestore";

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------

const PAGE_SIZE = 500;
const WRITE_CONCURRENCY = 10;

// ---------------------------------------------------------------------------
// Auth guard
// ---------------------------------------------------------------------------

function isAuthorized(request: NextRequest): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    console.error("[streak-sweep] CRON_SECRET is not set");
    return false;
  }
  const authHeader = request.headers.get("authorization");
  return authHeader === `Bearer ${secret}`;
}

// ---------------------------------------------------------------------------
// Date helpers (UTC, matching streak.ts)
// ---------------------------------------------------------------------------

function utcDateOffset(daysAgo: number): string {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - daysAgo);
  return d.toISOString().slice(0, 10);
}

// ---------------------------------------------------------------------------
// Route handler
// ---------------------------------------------------------------------------

/**
 * GET /api/cron/streak-sweep
 *
 * Triggered daily by Vercel Cron at 00:05 UTC (just after UTC midnight).
 * Finds all users whose lastActiveDate is older than yesterday — meaning they
 * have missed at least one full UTC day — and resets their streak:
 *
 *  - paid tier + streakFreeze=true  → consume freeze (streakFreeze=false), keep currentStreak
 *  - everyone else                  → currentStreak = 0
 *
 * This keeps the streak badge accurate even for users who never open the app
 * again (without the sweep, their badge would show a stale non-zero value until
 * their next message, when evaluateAndUpdateStreak resets it live).
 *
 * Users with currentStreak === 0 are skipped (nothing to reset).
 * Users with lastActiveDate === null (never active) are skipped by the query.
 */
export async function GET(request: NextRequest) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  // "before yesterday" means the user's last active day was two or more UTC
  // calendar days ago — they missed at least yesterday entirely.
  const yesterday = utcDateOffset(1);
  const startedAt = Date.now();

  let totalReset = 0;
  let totalFroze = 0;
  let totalSkipped = 0;
  let pagesProcessed = 0;
  let lastDoc: QueryDocumentSnapshot | null = null;

  try {
    // Equality on a single field — no composite index required.
    // We use "<" on a YYYY-MM-DD string; lexicographic ordering is correct for
    // ISO dates. Users with lastActiveDate stored as Firestore Timestamp (legacy)
    // won't match this query; they get corrected by streak.ts on next activity.
    const baseQuery = adminDb
      .collection("users")
      .where("lastActiveDate", "<", yesterday)
      .select("currentStreak", "streakFreeze", "tier")
      .limit(PAGE_SIZE);

    while (true) {
      const pageQuery: Query<DocumentData> =
        lastDoc !== null ? baseQuery.startAfter(lastDoc) : baseQuery;

      const snapshot = await pageQuery.get();
      pagesProcessed++;

      if (snapshot.empty) break;

      // Split into chunks for bounded concurrent writes.
      const docs = snapshot.docs.filter((doc) => {
        const d = doc.data() as Record<string, unknown>;
        return typeof d.currentStreak === "number" && d.currentStreak > 0;
      });

      totalSkipped += snapshot.docs.length - docs.length;

      for (let i = 0; i < docs.length; i += WRITE_CONCURRENCY) {
        const chunk = docs.slice(i, i + WRITE_CONCURRENCY);
        await Promise.allSettled(
          chunk.map(async (doc) => {
            const d = doc.data() as Record<string, unknown>;
            const isPaid =
              d.tier === "pro" || d.tier === "premium" || d.tier === "school_pro";
            const hasFreeze = d.streakFreeze === true;

            if (isPaid && hasFreeze) {
              // Consume the freeze — streak is preserved. The user gets one
              // "free" missed day, matching the live evaluateAndUpdateStreak logic.
              await doc.ref.update({ streakFreeze: false });
              totalFroze++;
            } else {
              await doc.ref.update({
                currentStreak: 0,
                // FieldValue.serverTimestamp() would overwrite lastActiveDate, which
                // we want to preserve so the streak function can compute the gap
                // correctly when the user next sends a message.
                lastStreakResetAt: FieldValue.serverTimestamp(),
              });
              totalReset++;
            }
          }),
        );
      }

      if (snapshot.docs.length < PAGE_SIZE) break;
      lastDoc = snapshot.docs[snapshot.docs.length - 1] ?? null;
    }
  } catch (err) {
    console.error("[streak-sweep] Fatal error:", err);
    return NextResponse.json({ error: "internal_error" }, { status: 500 });
  }

  const durationMs = Date.now() - startedAt;

  console.log(
    `[streak-sweep] done — reset=${totalReset} freeze_consumed=${totalFroze} ` +
      `skipped=${totalSkipped} pages=${pagesProcessed} duration=${durationMs}ms`,
  );

  return NextResponse.json({
    ok: true,
    cutoff: yesterday,
    reset: totalReset,
    freezeConsumed: totalFroze,
    skipped: totalSkipped,
    pages: pagesProcessed,
    durationMs,
  });
}
