import { NextRequest, NextResponse } from "next/server";
import { verifyAuthToken } from "@/lib/firebase/auth";
import { adminDb } from "@/lib/firebase/admin";
import type { Quiz, Question } from "@/lib/quiz/types";

type SafeQuestion = Omit<Question, "correctAnswer" | "correctIndex" | "wrongExplanations"> & {
  correctAnswer?: string;
  correctIndex?: number | null;
  wrongExplanations?: Record<string, string>;
};

function stripSensitiveFields(question: Question): SafeQuestion {
  const q = question as Record<string, unknown>;
  const safe: Record<string, unknown> = { ...q };
  delete safe.correctAnswer;
  delete safe.correctIndex;
  delete safe.wrongExplanations;
  return safe as unknown as SafeQuestion;
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const decoded = await verifyAuthToken(request);
  if (!decoded) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const { id: quizId } = await params;
  const uid = decoded.uid;

  const quizSnap = await adminDb
    .collection("users")
    .doc(uid)
    .collection("quizzes")
    .doc(quizId)
    .get();

  if (!quizSnap.exists) {
    return NextResponse.json({ error: "quiz_not_found" }, { status: 404 });
  }

  const data = quizSnap.data() as Omit<Quiz, "quizId">;

  const questions: SafeQuestion[] = data.questions.map((q) =>
    q.userAnswer !== null ? q : stripSensitiveFields(q),
  );

  return NextResponse.json({ quizId, ...data, questions });
}
