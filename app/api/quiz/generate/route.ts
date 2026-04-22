import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { FieldValue } from "firebase-admin/firestore";
import { verifyAuthToken } from "@/lib/firebase/auth";
import { adminDb } from "@/lib/firebase/admin";
import { generateQuiz, QuizGenerationError } from "@/lib/quiz/generate";

const FREE_DAILY_QUIZ_LIMIT = 5;

const QuizGenerateSchema = z.object({
  conversationId: z.string().min(1),
  messageId: z.string().min(1),
});

export async function POST(request: NextRequest) {
  // 1. Auth
  const decoded = await verifyAuthToken(request);
  if (!decoded) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  // 2. Parse + validate input
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  const parsed = QuizGenerateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "validation_error", details: parsed.error.flatten().fieldErrors },
      { status: 400 },
    );
  }

  const { conversationId, messageId } = parsed.data;
  const uid = decoded.uid;

  // 3. Verify conversation exists and belongs to user
  const convSnap = await adminDb.collection("conversations").doc(conversationId).get();
  if (!convSnap.exists) {
    return NextResponse.json({ error: "conversation_not_found" }, { status: 404 });
  }
  const convData = convSnap.data() as Record<string, unknown>;
  if (convData.userId !== uid) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const subject = (convData.subject as string) ?? "general";
  const grade = (convData.grade as number) ?? 9;

  // 4. Fetch seed message (the specific assistant message being quizzed)
  const msgSnap = await adminDb
    .collection("conversations")
    .doc(conversationId)
    .collection("messages")
    .doc(messageId)
    .get();
  if (!msgSnap.exists) {
    return NextResponse.json({ error: "message_not_found" }, { status: 404 });
  }
  const seedMessage = ((msgSnap.data() as Record<string, unknown>).content as string) ?? "";
  if (seedMessage.length < 50) {
    return NextResponse.json({ error: "seed_too_short" }, { status: 400 });
  }

  // 5. Fetch last 6 messages for context (same pattern as chat route)
  const historySnap = await adminDb
    .collection("conversations")
    .doc(conversationId)
    .collection("messages")
    .orderBy("createdAt", "desc")
    .limit(6)
    .get();
  const recentContext = historySnap.docs
    .reverse()
    .map((d) => {
      const data = d.data();
      const role = data.role === "assistant" ? "AI" : "Skolēns";
      return `${role}: ${data.content as string}`;
    })
    .join("\n\n");

  // 6. Fetch user doc for tier
  const userSnap = await adminDb.collection("users").doc(uid).get();
  if (!userSnap.exists) {
    return NextResponse.json({ error: "user_not_found" }, { status: 404 });
  }
  const tier = ((userSnap.data() as Record<string, unknown>).tier as string) ?? "free";

  // 7. Daily quiz limit (free tier only)
  const now = new Date();
  const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;

  if (tier === "free") {
    const dailySnap = await adminDb
      .collection("users")
      .doc(uid)
      .collection("usage")
      .doc(today)
      .get();
    const quizCount =
      dailySnap.exists
        ? (((dailySnap.data() as Record<string, unknown>).quizCount as number) ?? 0)
        : 0;
    if (quizCount >= FREE_DAILY_QUIZ_LIMIT) {
      return NextResponse.json({ error: "quiz_daily_limit_exceeded" }, { status: 429 });
    }
  }

  // 8. Generate quiz (calls LLM, persists to Firestore, logs tokens)
  try {
    const result = await generateQuiz(uid, conversationId, messageId, tier, {
      seedMessage,
      recentContext,
      subject,
      grade,
    });

    // 9. Bump daily quiz count
    await adminDb
      .collection("users")
      .doc(uid)
      .collection("usage")
      .doc(today)
      .set({ quizCount: FieldValue.increment(1) }, { merge: true });

    return NextResponse.json(result);
  } catch (err) {
    if (err instanceof QuizGenerationError) {
      return NextResponse.json({ error: "quiz_generation_failed" }, { status: 500 });
    }
    console.error("Quiz generation unexpected error:", err);
    return NextResponse.json({ error: "internal_error" }, { status: 500 });
  }
}
