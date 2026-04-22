import { chat, type AiModelChoice } from "@/lib/ai/deepseek";
import { buildQuizGenerationPrompt } from "./prompts";
import { QuizGenerationResponseSchema, type QuizGenerateResponse, type Question } from "./types";
import { adminDb } from "@/lib/firebase/admin";
import { FieldValue } from "firebase-admin/firestore";

export class QuizGenerationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "QuizGenerationError";
  }
}

function modelForTier(tier: string): AiModelChoice {
  // free → DeepSeek, all paid tiers → Claude (matches §2 tier table)
  return tier === "free" ? "deepseek" : "claude";
}

function parseAndValidate(text: string): ReturnType<typeof QuizGenerationResponseSchema.parse> | null {
  const stripped = text.replace(/^```(?:json)?\n?/, "").replace(/\n?```$/, "").trim();
  let raw: unknown;
  try {
    raw = JSON.parse(stripped);
  } catch {
    return null;
  }
  const result = QuizGenerationResponseSchema.safeParse(raw);
  return result.success ? result.data : null;
}

export async function generateQuiz(
  uid: string,
  conversationId: string,
  messageId: string,
  tier: string,
  params: {
    seedMessage: string;
    recentContext: string;
    subject: string;
    grade: number;
  },
): Promise<QuizGenerateResponse> {
  const model = modelForTier(tier);
  const desiredCount = 5;

  const { system, user } = buildQuizGenerationPrompt({ ...params, desiredCount });

  const messages = [
    { role: "system" as const, content: system },
    { role: "user" as const, content: user },
  ];

  let aiResult = await chat(messages, 0.4, model, 800);
  let validated = parseAndValidate(aiResult.content);

  if (!validated) {
    const retryMessages = [
      ...messages,
      { role: "assistant" as const, content: aiResult.content },
      {
        role: "user" as const,
        content: "Iepriekšējā atbilde nebija derīgs JSON. Atgriez tikai JSON.",
      },
    ];
    aiResult = await chat(retryMessages, 0.4, model, 800);
    validated = parseAndValidate(aiResult.content);
    if (!validated) {
      throw new QuizGenerationError("quiz_generation_failed");
    }
  }

  const now = new Date();
  const questions: Question[] = validated.questions.map((q, i) => {
    const id = `q_${i}`;
    if (q.type === "multiple_choice") {
      return {
        id,
        type: "multiple_choice" as const,
        question: q.question,
        choices: q.choices,
        correctAnswer: q.choices[q.correctIndex]!,
        correctIndex: q.correctIndex,
        wrongExplanations: q.wrongExplanations,
        userAnswer: null,
        wasCorrect: null,
        explanation: q.explanation,
      };
    }
    return {
      id,
      type: "open_ended" as const,
      question: q.question,
      choices: null,
      correctAnswer: q.correctAnswer,
      correctIndex: null,
      userAnswer: null,
      wasCorrect: null,
      explanation: q.explanation,
    };
  });

  const quizRef = adminDb.collection("users").doc(uid).collection("quizzes").doc();
  const quizId = quizRef.id;

  await quizRef.set({
    conversationId,
    messageId,
    subject: params.subject,
    grade: params.grade,
    createdAt: now.toISOString(),
    completedAt: null,
    score: null,
    total: questions.length,
    contextSnippet: params.seedMessage.slice(0, 500),
    questions,
  });

  const yearMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  await adminDb
    .collection("users")
    .doc(uid)
    .collection("usage")
    .doc(yearMonth)
    .set(
      {
        inputTokens: FieldValue.increment(aiResult.usage.prompt_tokens),
        outputTokens: FieldValue.increment(aiResult.usage.completion_tokens),
      },
      { merge: true },
    );

  return {
    quizId,
    questions: questions.map((q) => ({
      id: q.id,
      type: q.type,
      question: q.question,
      choices: q.choices,
    })),
  };
}
