import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { verifyAuthToken } from "@/lib/firebase/auth";
import { adminDb } from "@/lib/firebase/admin";
import {
  answerQuestion,
  QuizNotFoundError,
  QuestionNotFoundError,
  QuestionAlreadyAnsweredError,
} from "@/lib/quiz/answer";

const QuizAnswerSchema = z.object({
  quizId: z.string().min(1),
  questionId: z.string().min(1),
  userAnswer: z.string().min(1).max(500).transform((s) => s.trim()),
});

export async function POST(request: NextRequest) {
  const decoded = await verifyAuthToken(request);
  if (!decoded) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  const parsed = QuizAnswerSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "validation_error", details: parsed.error.flatten().fieldErrors },
      { status: 400 },
    );
  }

  const { quizId, questionId, userAnswer } = parsed.data;
  const uid = decoded.uid;

  // Fetch user tier
  const userSnap = await adminDb.collection("users").doc(uid).get();
  const tier = userSnap.exists
    ? (((userSnap.data() as Record<string, unknown>).tier as string) ?? "free")
    : "free";

  try {
    const result = await answerQuestion(uid, quizId, questionId, userAnswer, tier);
    return NextResponse.json(result);
  } catch (err) {
    if (err instanceof QuizNotFoundError) {
      return NextResponse.json({ error: "quiz_not_found" }, { status: 404 });
    }
    if (err instanceof QuestionNotFoundError) {
      return NextResponse.json({ error: "question_not_found" }, { status: 404 });
    }
    if (err instanceof QuestionAlreadyAnsweredError) {
      return NextResponse.json({ error: "question_already_answered" }, { status: 409 });
    }
    console.error("Quiz answer unexpected error:", err);
    return NextResponse.json({ error: "internal_error" }, { status: 500 });
  }
}
