import { adminDb } from "@/lib/firebase/admin";
import { FieldValue } from "firebase-admin/firestore";
import { chat, type AiModelChoice } from "@/lib/ai/deepseek";
import { buildOpenEndedGradingPrompt } from "./prompts";
import type { Quiz, Question, QuizAnswerResponse } from "./types";

export class QuestionAlreadyAnsweredError extends Error {
  constructor() {
    super("question_already_answered");
    this.name = "QuestionAlreadyAnsweredError";
  }
}

export class QuizNotFoundError extends Error {
  constructor() {
    super("quiz_not_found");
    this.name = "QuizNotFoundError";
  }
}

export class QuestionNotFoundError extends Error {
  constructor() {
    super("question_not_found");
    this.name = "QuestionNotFoundError";
  }
}

type QuizDoc = Omit<Quiz, "quizId">;

function modelForTier(tier: string): AiModelChoice {
  return tier === "free" ? "deepseek" : "claude";
}

function parseGradingResult(text: string): { correct: boolean; explanation: string } | null {
  const stripped = text.replace(/^```(?:json)?\n?/, "").replace(/\n?```$/, "").trim();
  let raw: unknown;
  try {
    raw = JSON.parse(stripped);
  } catch {
    return null;
  }
  if (
    typeof raw === "object" &&
    raw !== null &&
    typeof (raw as Record<string, unknown>).correct === "boolean" &&
    typeof (raw as Record<string, unknown>).explanation === "string"
  ) {
    const r = raw as { correct: boolean; explanation: string };
    return { correct: r.correct, explanation: r.explanation };
  }
  return null;
}

async function gradeOpenEnded(
  question: Question,
  quizData: QuizDoc,
  userAnswer: string,
  tier: string,
): Promise<{
  wasCorrect: boolean;
  explanation: string;
  usage: { prompt_tokens: number; completion_tokens: number };
}> {
  const model: AiModelChoice = modelForTier(tier);
  const { system, user } = buildOpenEndedGradingPrompt({
    question: question.question,
    correctAnswer: question.correctAnswer,
    userAnswer,
    subject: quizData.subject,
    grade: quizData.grade,
  });

  const messages = [
    { role: "system" as const, content: system },
    { role: "user" as const, content: user },
  ];

  let aiResult = await chat(messages, 0.1, model, 200);
  let graded = parseGradingResult(aiResult.content);

  if (!graded) {
    const retryMessages = [
      ...messages,
      { role: "assistant" as const, content: aiResult.content },
      {
        role: "user" as const,
        content: 'Atgriez tikai JSON: { "correct": true/false, "explanation": "..." }',
      },
    ];
    aiResult = await chat(retryMessages, 0.1, model, 200);
    graded = parseGradingResult(aiResult.content);
    if (!graded) {
      // Graceful degradation: mark incorrect, generic explanation
      graded = { correct: false, explanation: "Neizdevās novērtēt atbildi. Mēģini vēlreiz." };
    }
  }

  return {
    wasCorrect: graded.correct,
    explanation: graded.explanation,
    usage: {
      prompt_tokens: aiResult.usage.prompt_tokens,
      completion_tokens: aiResult.usage.completion_tokens,
    },
  };
}

export async function answerQuestion(
  uid: string,
  quizId: string,
  questionId: string,
  userAnswer: string,
  tier: string,
): Promise<QuizAnswerResponse> {
  const quizRef = adminDb.collection("users").doc(uid).collection("quizzes").doc(quizId);

  // Preliminary read to validate and get context for the LLM call (open-ended only).
  // The transaction below re-validates atomically before writing.
  const prelimSnap = await quizRef.get();
  if (!prelimSnap.exists) throw new QuizNotFoundError();

  const prelimData = prelimSnap.data() as QuizDoc;
  const question = prelimData.questions.find((q) => q.id === questionId);
  if (!question) throw new QuestionNotFoundError();
  if (question.userAnswer !== null) throw new QuestionAlreadyAnsweredError();

  // Evaluate answer (LLM call for open-ended happens outside the transaction)
  let wasCorrect: boolean;
  let explanation: string;
  let tokenUsage: { prompt_tokens: number; completion_tokens: number } | null = null;

  if (question.type === "multiple_choice") {
    wasCorrect = userAnswer === question.correctAnswer;
    explanation = wasCorrect
      ? (question.explanation ?? "")
      : (question.wrongExplanations?.[userAnswer] ?? question.explanation ?? "");
  } else {
    const graded = await gradeOpenEnded(question, prelimData, userAnswer, tier);
    wasCorrect = graded.wasCorrect;
    explanation = graded.explanation;
    tokenUsage = graded.usage;
  }

  // Atomic read → verify → write to prevent double-submission races
  let response!: QuizAnswerResponse;
  await adminDb.runTransaction(async (tx) => {
    const snap = await tx.get(quizRef);
    if (!snap.exists) throw new QuizNotFoundError();

    const quiz = snap.data() as QuizDoc;
    const idx = quiz.questions.findIndex((q) => q.id === questionId);
    if (idx === -1) throw new QuestionNotFoundError();

    const q = quiz.questions[idx]!;
    if (q.userAnswer !== null) throw new QuestionAlreadyAnsweredError();

    const updatedQuestions: Question[] = quiz.questions.map((orig, i) =>
      i === idx ? { ...orig, userAnswer, wasCorrect, explanation } : orig,
    );

    const isComplete = updatedQuestions.every((item) => item.userAnswer !== null);
    const score = isComplete ? updatedQuestions.filter((item) => item.wasCorrect).length : null;

    const updates: Record<string, unknown> = { questions: updatedQuestions };
    if (isComplete) {
      updates.completedAt = new Date().toISOString();
      updates.score = score;
    }

    tx.update(quizRef, updates);

    response = {
      wasCorrect,
      explanation,
      isComplete,
      ...(score !== null ? { score } : {}),
    };
  });

  // Log token usage for open-ended answers after the transaction completes
  if (tokenUsage) {
    const now = new Date();
    const yearMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
    await adminDb
      .collection("users")
      .doc(uid)
      .collection("usage")
      .doc(yearMonth)
      .set(
        {
          inputTokens: FieldValue.increment(tokenUsage.prompt_tokens),
          outputTokens: FieldValue.increment(tokenUsage.completion_tokens),
        },
        { merge: true },
      );
  }

  return response;
}
