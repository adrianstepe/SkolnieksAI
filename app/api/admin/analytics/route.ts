/**
 * GET /api/admin/analytics
 *
 * Returns high-level Firestore metrics for the admin dashboard overview.
 * Reads from the `users` and `conversations` root collections.
 * Defaults gracefully to 0 if a collection is missing or empty.
 */

import { NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    // Run all count queries in parallel to keep latency low
    const [usersSnap, convsSnap] = await Promise.all([
      adminDb.collection("users").count().get(),
      adminDb.collection("conversations").count().get(),
    ]);

    const totalUsers = usersSnap.data().count ?? 0;
    const totalConversations = convsSnap.data().count ?? 0;

    // Count messages via collection group (single index scan, no document fetch)
    let totalMessages = 0;
    try {
      const msgsSnap = await adminDb.collectionGroup("messages").count().get();
      totalMessages = msgsSnap.data().count ?? 0;
    } catch {
      // Collection group index may not exist yet — treat as N/A (0)
      totalMessages = 0;
    }

    // Active today: users where lastActive >= start of today (UTC)
    const todayStart = new Date();
    todayStart.setUTCHours(0, 0, 0, 0);

    let activeToday = 0;
    try {
      const activeSnap = await adminDb
        .collection("users")
        .where("lastActive", ">=", todayStart)
        .count()
        .get();
      activeToday = activeSnap.data().count ?? 0;
    } catch {
      // field may not exist on all documents — ignore
      activeToday = 0;
    }

    return NextResponse.json({
      totalUsers,
      totalConversations,
      totalMessages,
      activeToday,
    });
  } catch (err) {
    console.error("[admin/analytics] Failed to fetch metrics:", err);
    return NextResponse.json(
      { error: "Failed to fetch analytics" },
      { status: 500 },
    );
  }
}
