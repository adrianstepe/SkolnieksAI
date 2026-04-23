import { vi, describe, it, expect, beforeEach } from "vitest";
import {
  answerQuestion,
  QuestionAlreadyAnsweredError,
  QuizNotFoundError,
} from "./answer";
import type { Question } from "./types";

const mockChat = vi.hoisted(() => vi.fn());
const mockFirestoreUpdate = vi.hoisted(() => vi.fn().mockResolvedValue(undefined));
const mockFirestoreSet = vi.hoisted(() => vi.fn().mockResolvedValue(undefined));

let mockQuizData: Record<string, unknown> | null = null;

vi.mock("@/lib/ai/deepseek", () => ({ chat: mockChat }));
vi.mock("firebase-admin/firestore", () => ({
  FieldValue: { increment: (n: number) => n },
}));

vi.mock("@/lib/firebase/admin", () => {
  const makeRef = (data?: Record<string, unknown> | null) => ({
    get: vi.fn().mockResolvedValue({
      exists: data !== null,
      data: () => data,
    }),
    update: mockFirestoreUpdate,
    set: mockFirestoreSet,
    collection: (name: string) => ({
      doc: () => makeRef(name === "quizzes" ? mockQuizData : {}),
    }),
  });

  return {
    adminDb: {
      collection: (name: string) => ({
        doc: (id?: string) => {
          if (name === "users") {
            return {
              get: vi.fn().mockResolvedValue({ exists: true, data: () => ({}) }),
              collection: (subName: string) => ({
                doc: () => makeRef(subName === "quizzes" ? mockQuizData : {}),
              }),
            };
          }
          void id;
          return makeRef(mockQuizData);
        },
      }),
      runTransaction: vi.fn(async (fn: (tx: unknown) => Promise<unknown>) => {
        const tx = {
          get: vi.fn().mockResolvedValue({
            exists: mockQuizData !== null,
            data: () => mockQuizData,
          }),
          update: mockFirestoreUpdate,
        };
        return fn(tx);
      }),
    },
  };
});

const MC_QUESTION: Question = {
  id: "q_0",
  type: "multiple_choice",
  question: "Kas ir fotosintēze?",
  choices: ["Gaismas enerģija", "B", "C", "D"],
  correctAnswer: "Gaismas enerģija",
  correctIndex: 0,
  wrongExplanations: {
    B: "B nav pareizs, jo...",
    C: "C nav pareizs, jo...",
    D: "D nav pareizs, jo...",
  },
  userAnswer: null,
  wasCorrect: null,
  explanation: "Fotosintēze izmanto gaismas enerģiju.",
};

const OE_QUESTION: Question = {
  id: "q_1",
  type: "open_ended",
  question: "Kāda viela absorbē gaismu?",
  choices: null,
  correctAnswer: "Hlorofils",
  correctIndex: null,
  userAnswer: null,
  wasCorrect: null,
  explanation: "Hlorofils absorbē gaismu fotosintēzes laikā.",
};

function makeQuizDoc(questions: Question[]) {
  return {
    conversationId: "conv1",
    messageId: "msg1",
    subject: "biology",
    grade: 8,
    createdAt: "2026-01-01T00:00:00.000Z",
    completedAt: null,
    score: null,
    total: questions.length,
    contextSnippet: "Fotosintēze ir process...",
    questions,
  };
}

describe("answerQuestion", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFirestoreUpdate.mockResolvedValue(undefined);
    mockFirestoreSet.mockResolvedValue(undefined);
  });

  it("MC correct answer: wasCorrect=true, uses correctAnswer explanation", async () => {
    mockQuizData = makeQuizDoc([MC_QUESTION]);

    const result = await answerQuestion("uid1", "quiz1", "q_0", "Gaismas enerģija", "free");

    expect(result.wasCorrect).toBe(true);
    expect(result.explanation).toBe("Fotosintēze izmanto gaismas enerģiju.");
    expect(result.isComplete).toBe(true);
    expect(result.score).toBe(1);
    expect(mockChat).not.toHaveBeenCalled();
  });

  it("MC wrong answer: wasCorrect=false, uses wrongExplanations[userAnswer]", async () => {
    mockQuizData = makeQuizDoc([MC_QUESTION]);

    const result = await answerQuestion("uid1", "quiz1", "q_0", "B", "free");

    expect(result.wasCorrect).toBe(false);
    expect(result.explanation).toBe("B nav pareizs, jo...");
    expect(result.isComplete).toBe(true);
    expect(result.score).toBe(0);
    expect(mockChat).not.toHaveBeenCalled();
  });

  it("open-ended correct: calls LLM, returns wasCorrect=true", async () => {
    mockQuizData = makeQuizDoc([OE_QUESTION]);
    mockChat.mockResolvedValue({
      content: JSON.stringify({ correct: true, explanation: "Pareizi — hlorofils ir pigments." }),
      usage: { prompt_tokens: 50, completion_tokens: 30, total_tokens: 80 },
    });

    const result = await answerQuestion("uid1", "quiz1", "q_1", "Hlorofils", "free");

    expect(result.wasCorrect).toBe(true);
    expect(result.explanation).toBe("Pareizi — hlorofils ir pigments.");
    expect(result.isComplete).toBe(true);
    expect(mockChat).toHaveBeenCalledTimes(1);
  });

  it("open-ended: retries once on bad JSON, succeeds on second attempt", async () => {
    mockQuizData = makeQuizDoc([OE_QUESTION]);
    mockChat
      .mockResolvedValueOnce({ content: "not json", usage: { prompt_tokens: 50, completion_tokens: 10, total_tokens: 60 } })
      .mockResolvedValueOnce({
        content: JSON.stringify({ correct: false, explanation: "Nepareizi." }),
        usage: { prompt_tokens: 60, completion_tokens: 20, total_tokens: 80 },
      });

    const result = await answerQuestion("uid1", "quiz1", "q_1", "wrong", "free");

    expect(result.wasCorrect).toBe(false);
    expect(mockChat).toHaveBeenCalledTimes(2);
  });

  it("double-submit: throws QuestionAlreadyAnsweredError if question already answered", async () => {
    mockQuizData = makeQuizDoc([{ ...MC_QUESTION, userAnswer: "Gaismas enerģija", wasCorrect: true }]);

    await expect(answerQuestion("uid1", "quiz1", "q_0", "B", "free")).rejects.toThrow(
      QuestionAlreadyAnsweredError,
    );
    expect(mockFirestoreUpdate).not.toHaveBeenCalled();
  });

  it("quiz not found: throws QuizNotFoundError", async () => {
    mockQuizData = null;

    await expect(answerQuestion("uid1", "missing_quiz", "q_0", "B", "free")).rejects.toThrow(
      QuizNotFoundError,
    );
  });

  it("multi-question quiz: isComplete=false until last question answered", async () => {
    const q0Answered: Question = { ...MC_QUESTION, userAnswer: "Gaismas enerģija", wasCorrect: true };
    mockQuizData = makeQuizDoc([q0Answered, OE_QUESTION]);
    mockChat.mockResolvedValue({
      content: JSON.stringify({ correct: true, explanation: "Pareizi." }),
      usage: { prompt_tokens: 50, completion_tokens: 20, total_tokens: 70 },
    });

    const result = await answerQuestion("uid1", "quiz1", "q_1", "Hlorofils", "pro");

    expect(result.isComplete).toBe(true);
    expect(result.score).toBe(2);
  });
});
