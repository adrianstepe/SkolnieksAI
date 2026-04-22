import { z } from "zod";

// §3 Firestore data model types

export interface MultipleChoiceQuestion {
  id: string;
  type: "multiple_choice";
  question: string;
  choices: string[];
  correctAnswer: string;
  correctIndex: number;
  wrongExplanations: Record<string, string>;
  userAnswer: string | null;
  wasCorrect: boolean | null;
  explanation: string | null;
}

export interface OpenEndedQuestion {
  id: string;
  type: "open_ended";
  question: string;
  choices: null;
  correctAnswer: string;
  correctIndex: null;
  wrongExplanations?: never;
  userAnswer: string | null;
  wasCorrect: boolean | null;
  explanation: string | null;
}

export type Question = MultipleChoiceQuestion | OpenEndedQuestion;

export interface Quiz {
  quizId: string;
  conversationId: string;
  messageId: string;
  subject: string;
  grade: number;
  createdAt: string;
  completedAt: string | null;
  score: number | null;
  total: number;
  contextSnippet: string;
  questions: Question[];
}

// §5 API request/response types

// POST /api/quiz/generate
export interface QuizGenerateRequest {
  conversationId: string;
  messageId: string;
}

export interface QuizGenerateResponseQuestion {
  id: string;
  type: "multiple_choice" | "open_ended";
  question: string;
  choices: string[] | null;
}

export interface QuizGenerateResponse {
  quizId: string;
  questions: QuizGenerateResponseQuestion[];
}

// POST /api/quiz/answer
export interface QuizAnswerRequest {
  quizId: string;
  questionId: string;
  userAnswer: string;
}

export interface QuizAnswerResponse {
  wasCorrect: boolean;
  explanation: string;
  isComplete: boolean;
  score?: number;
}

// LLM response validation schema (used in lib/quiz/generate.ts)
const MultipleChoiceLLMSchema = z.object({
  type: z.literal("multiple_choice"),
  question: z.string().min(1),
  choices: z.array(z.string()).length(4),
  correctIndex: z.number().int().min(0).max(3),
  explanation: z.string().min(1),
  wrongExplanations: z.record(z.string()),
});

const OpenEndedLLMSchema = z.object({
  type: z.literal("open_ended"),
  question: z.string().min(1),
  correctAnswer: z.string().min(1),
  explanation: z.string().min(1),
});

export const QuizGenerationResponseSchema = z.object({
  questions: z
    .array(z.discriminatedUnion("type", [MultipleChoiceLLMSchema, OpenEndedLLMSchema]))
    .min(1)
    .max(5),
});

export type QuizGenerationResponse = z.infer<typeof QuizGenerationResponseSchema>;
