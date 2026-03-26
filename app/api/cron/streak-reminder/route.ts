import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase/admin";
import { sendStreakReminderEmail } from "@/lib/email/resend";
import type { QueryDocumentSnapshot } from "firebase-admin/firestore";

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------

/** Firestore page size — keeps each batch well inside the 10 MB document limit
 *  and leaves headroom for other reads happening during the same Vercel invocation. */
const PAGE_SIZE = 200;

/** Max concurrent Resend API calls per page — avoids rate-limit bursts. */
const EMAIL_CONCURRENCY = 10;

// ---------------------------------------------------------------------------
// Auth guard
// ---------------------------------------------------------------------------

function isAuthorized(request: NextRequest): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    console.error("[streak-reminder] CRON_SECRET is not set");
    return false;
  }
  const authHeader = request.headers.get("authorization");
  return authHeader === `Bearer ${secret}`;
}

// ---------------------------------------------------------------------------
// Date helpers (UTC, matching streak.ts)
// ---------------------------------------------------------------------------

/** Returns a YYYY-MM-DD string for N calendar days ago in UTC. */
function utcDateOffset(daysAgo: number): string {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - daysAgo);
  return d.toISOString().slice(0, 10);
}

// ---------------------------------------------------------------------------
// Core logic
// ---------------------------------------------------------------------------

/**
 * Sends batches of 10 emails concurrently from an array of payloads,
 * collecting per-address outcomes without throwing on individual failures.
 */
async function dispatchEmails(
  docs: QueryDocumentSnapshot[],
): Promise<{ sent: number; failed: number }> {
  let sent = 0;
  let failed = 0;

  // Chunk into groups of EMAIL_CONCURRENCY
  for (let i = 0; i < docs.length; i += EMAIL_CONCURRENCY) {
    const chunk = docs.slice(i, i + EMAIL_CONCURRENCY);

    const results = await Promise.allSettled(
      chunk.map((doc) => {
        const data = doc.data() as Record<string, unknown>;
        const email = data.email as string;
        return sendStreakReminderEmail({
          to: email,
          displayName: (data.displayName as string) ?? null,
          currentStreak: (data.currentStreak as number) ?? 1,
        });
      }),
    );

    for (const result of results) {
      if (result.status === "fulfilled" && result.value) {
        sent++;
      } else {
        failed++;
      }
    }
  }

  return { sent, failed };
}

// ---------------------------------------------------------------------------
// Route handler
// ---------------------------------------------------------------------------

/**
 * GET /api/cron/streak-reminder
 *
 * Triggered daily by Vercel Cron at 18:00 UTC (6 hours before UTC midnight).
 * Queries for users whose lastActiveDate is exactly yesterday — meaning they
 * have an active streak but have not yet logged in today — and sends each a
 * reminder email via Resend.
 *
 * Firestore read strategy:
 *  - Single equality filter on `lastActiveDate` (no composite index required).
 *  - `.select()` fetches only the four fields we need, reducing read bandwidth.
 *  - Cursor-based pagination in pages of 200 to stay within memory and the
 *    Vercel function timeout (300 s on Pro, 60 s on Hobby).
 *  - In-process filter drops users with currentStreak === 0 or no email
 *    (avoids needing a composite index for the streak inequality).
 */
export async function GET(request: NextRequest) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const yesterday = utcDateOffset(1);
  const startedAt = Date.now();

  let totalSent = 0;
  let totalFailed = 0;
  let totalSkipped = 0;
  let pagesProcessed = 0;
  let lastDoc: QueryDocumentSnapshot | null = null;

  try {
    // Base query — equality on one field requires no composite index.
    const baseQuery = adminDb
      .collection("users")
      .where("lastActiveDate", "==", yesterday)
      // Fetch only the fields the email function needs. Saves ~80% of read bytes
      // compared to pulling entire user documents.
      .select("email", "displayName", "currentStreak")
      .limit(PAGE_SIZE);

    while (true) {
      const pageQuery =
        lastDoc !== null ? baseQuery.startAfter(lastDoc) : baseQuery;

      const snapshot = await pageQuery.get();
      pagesProcessed++;

      if (snapshot.empty) break;

      // Filter in-process: skip users with no email or a broken/zero streak.
      const eligible = snapshot.docs.filter((doc) => {
        const data = doc.data() as Record<string, unknown>;
        return (
          typeof data.email === "string" &&
          data.email.length > 0 &&
          typeof data.currentStreak === "number" &&
          data.currentStreak > 0
        );
      });

      totalSkipped += snapshot.docs.length - eligible.length;

      const { sent, failed } = await dispatchEmails(eligible);
      totalSent += sent;
      totalFailed += failed;

      // Advance cursor or exit when we've consumed all matching docs.
      if (snapshot.docs.length < PAGE_SIZE) break;
      lastDoc = snapshot.docs[snapshot.docs.length - 1] ?? null;
    }
  } catch (err) {
    console.error("[streak-reminder] Fatal error during sweep:", err);
    return NextResponse.json(
      { error: "internal_error", detail: String(err) },
      { status: 500 },
    );
  }

  const durationMs = Date.now() - startedAt;

  console.log(
    `[streak-reminder] done — sent=${totalSent} failed=${totalFailed} ` +
      `skipped=${totalSkipped} pages=${pagesProcessed} duration=${durationMs}ms`,
  );

  return NextResponse.json({
    ok: true,
    date: yesterday,
    sent: totalSent,
    failed: totalFailed,
    skipped: totalSkipped,
    pages: pagesProcessed,
    durationMs,
  });
}
