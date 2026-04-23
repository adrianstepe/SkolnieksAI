"use client";

import { useReducer, useEffect } from "react";
import { isQuizEnabled } from "@/lib/features";
import { QuizQuestionCard, type AnswerCallbackData } from "./QuizQuestionCard";
import { QuizResultScreen, type AnsweredQuestion } from "./QuizResultScreen";
import type { QuizGenerateResponseQuestion } from "@/lib/quiz/types";

// ---------------------------------------------------------------------------
// State machine
// ---------------------------------------------------------------------------

type QuizPhase =
  | { tag: "idle" }
  | { tag: "loading" }
  | { tag: "error"; message: string }
  | { tag: "answering"; questionIndex: number }
  | { tag: "result"; score: number; total: number };

export interface QuizPanelState {
  phase: QuizPhase;
  quizId: string | null;
  questions: QuizGenerateResponseQuestion[];
  answered: AnsweredQuestion[];
}

export type QuizAction =
  | { type: "START" }
  | { type: "LOADED"; quizId: string; questions: QuizGenerateResponseQuestion[] }
  | { type: "ERROR"; message: string }
  | {
      type: "ANSWER";
      answered: AnsweredQuestion;
      isComplete: boolean;
      score?: number;
    }
  | { type: "CLOSE" }
  | {
      type: "RESTORE";
      quizId: string;
      questions: QuizGenerateResponseQuestion[];
      answered: AnsweredQuestion[];
      nextIndex: number;
      result?: { score: number; total: number };
    };

const INITIAL_STATE: QuizPanelState = {
  phase: { tag: "idle" },
  quizId: null,
  questions: [],
  answered: [],
};

export function quizReducer(
  state: QuizPanelState,
  action: QuizAction,
): QuizPanelState {
  switch (action.type) {
    case "START":
      return { ...INITIAL_STATE, phase: { tag: "loading" } };
    case "LOADED":
      return {
        phase: { tag: "answering", questionIndex: 0 },
        quizId: action.quizId,
        questions: action.questions,
        answered: [],
      };
    case "ERROR":
      return { ...state, phase: { tag: "error", message: action.message } };
    case "ANSWER": {
      const newAnswered = [...state.answered, action.answered];
      if (action.isComplete) {
        return {
          ...state,
          answered: newAnswered,
          phase: {
            tag: "result",
            score: action.score ?? 0,
            total: state.questions.length,
          },
        };
      }
      const currentIndex =
        state.phase.tag === "answering" ? state.phase.questionIndex : 0;
      return {
        ...state,
        answered: newAnswered,
        phase: { tag: "answering", questionIndex: currentIndex + 1 },
      };
    }
    case "CLOSE":
      return { ...INITIAL_STATE };
    case "RESTORE":
      if (action.result) {
        return {
          phase: {
            tag: "result",
            score: action.result.score,
            total: action.result.total,
          },
          quizId: action.quizId,
          questions: action.questions,
          answered: action.answered,
        };
      }
      return {
        phase: { tag: "answering", questionIndex: action.nextIndex },
        quizId: action.quizId,
        questions: action.questions,
        answered: action.answered,
      };
    default:
      return state;
  }
}

// ---------------------------------------------------------------------------
// sessionStorage helpers
// ---------------------------------------------------------------------------

interface SessionData {
  quizId: string;
}

function sessionKey(conversationId: string) {
  return `quiz-${conversationId}`;
}

function saveSession(conversationId: string, quizId: string) {
  try {
    sessionStorage.setItem(
      sessionKey(conversationId),
      JSON.stringify({ quizId } satisfies SessionData),
    );
  } catch {
    // ignore — sessionStorage may be unavailable
  }
}

function clearSession(conversationId: string) {
  try {
    sessionStorage.removeItem(sessionKey(conversationId));
  } catch {
    // ignore
  }
}

function loadSession(conversationId: string): SessionData | null {
  try {
    const raw = sessionStorage.getItem(sessionKey(conversationId));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as unknown;
    if (
      typeof parsed === "object" &&
      parsed !== null &&
      typeof (parsed as Record<string, unknown>).quizId === "string"
    ) {
      return parsed as SessionData;
    }
    return null;
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// QuizPanel component
// ---------------------------------------------------------------------------

interface FetchedQuestion {
  id: string;
  type: "multiple_choice" | "open_ended";
  question: string;
  choices: string[] | null;
  userAnswer: string | null;
  wasCorrect: boolean | null;
  explanation: string | null;
}

interface FetchedQuiz {
  quizId: string;
  score: number | null;
  total: number;
  completedAt: string | null;
  questions: FetchedQuestion[];
}

interface Props {
  messageId: string;
  conversationId: string;
  getIdToken: () => Promise<string | null>;
  onClose: () => void;
  accentColor: string;
}

export function QuizPanel({
  messageId,
  conversationId,
  getIdToken,
  onClose,
  accentColor,
}: Props) {
  const [state, dispatch] = useReducer(quizReducer, INITIAL_STATE);

  useEffect(() => {
    const saved = loadSession(conversationId);

    if (saved) {
      let cancelled = false;

      void (async () => {
        try {
          const token = await getIdToken();
          const res = await fetch(`/api/quiz/${saved.quizId}`, {
            headers: token ? { Authorization: `Bearer ${token}` } : {},
          });
          if (!res.ok || cancelled) return;

          const data = (await res.json()) as FetchedQuiz;

          const rawQuestions: QuizGenerateResponseQuestion[] = data.questions.map(
            (q) => ({
              id: q.id,
              type: q.type,
              question: q.question,
              choices: q.choices,
            }),
          );

          const answered: AnsweredQuestion[] = data.questions
            .filter((q) => q.userAnswer !== null)
            .map((q) => ({
              id: q.id,
              question: q.question,
              userAnswer: q.userAnswer!,
              wasCorrect: q.wasCorrect!,
              explanation: q.explanation!,
            }));

          if (data.completedAt) {
            dispatch({
              type: "RESTORE",
              quizId: data.quizId,
              questions: rawQuestions,
              answered,
              nextIndex: 0,
              result: { score: data.score ?? 0, total: data.questions.length },
            });
            return;
          }

          const nextIndex = data.questions.findIndex((q) => q.userAnswer === null);
          if (nextIndex === -1) return;

          dispatch({
            type: "RESTORE",
            quizId: data.quizId,
            questions: rawQuestions,
            answered,
            nextIndex,
          });
        } catch {
          // Restore failed — fall through to generate below
          if (!cancelled) void generate();
        }
      })();

      return () => {
        cancelled = true;
      };
    } else {
      void generate();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function generate() {
    dispatch({ type: "START" });
    try {
      const token = await getIdToken();
      const res = await fetch("/api/quiz/generate", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ conversationId, messageId }),
      });

      if (!res.ok) {
        const err = (await res.json().catch(() => ({}))) as Record<string, unknown>;
        const errCode =
          res.status === 429
            ? "quiz_daily_limit_exceeded"
            : err.error === "seed_too_short"
            ? "seed_too_short"
            : "generation_failed";
        dispatch({ type: "ERROR", message: errCode });
        return;
      }

      const data = (await res.json()) as {
        quizId: string;
        questions: QuizGenerateResponseQuestion[];
      };
      saveSession(conversationId, data.quizId);
      dispatch({ type: "LOADED", quizId: data.quizId, questions: data.questions });
    } catch {
      dispatch({ type: "ERROR", message: "generation_failed" });
    }
  }

  function handleAnswer(data: AnswerCallbackData) {
    if (state.phase.tag !== "answering") return;
    const currentQuestion = state.questions[state.phase.questionIndex];
    if (!currentQuestion || !state.quizId) return;

    dispatch({
      type: "ANSWER",
      answered: {
        id: currentQuestion.id,
        question: currentQuestion.question,
        userAnswer: data.userAnswer,
        wasCorrect: data.wasCorrect,
        explanation: data.explanation,
      },
      isComplete: data.isComplete,
      score: data.score,
    });
  }

  function handleClose() {
    clearSession(conversationId);
    dispatch({ type: "CLOSE" });
    onClose();
  }

  if (!isQuizEnabled()) return null;

  const { phase } = state;

  return (
    <div
      className="mt-2 rounded-2xl border border-[#E5E7EB] dark:border-white/7 bg-white/50 dark:bg-[#1A2033]/50 p-4"
      style={{ borderTopWidth: "2px", borderTopColor: accentColor }}
      role="region"
      aria-label="Pašpārbaudes viktorīna"
    >
      {/* Header (hidden on result screen which has its own layout) */}
      {phase.tag !== "result" && (
        <div className="flex items-center justify-between mb-4">
          <span className="text-sm font-semibold text-[#111827] dark:text-[#E8ECF4]">
            Pārbaudi sevi
            {state.questions.length > 0
              ? ` — ${state.questions.length} jautājumi`
              : ""}
          </span>
          <div className="flex items-center gap-2">
            {phase.tag === "answering" && (
              <span
                className="text-xs text-[#6B7280] dark:text-[#8B95A8] tabular-nums"
                aria-label={`Jautājums ${phase.questionIndex + 1} no ${state.questions.length}`}
              >
                {phase.questionIndex + 1}/{state.questions.length}
              </span>
            )}
            <button
              onClick={handleClose}
              aria-label="Aizvērt pašpārbaudi"
              className="p-1 rounded-md text-[#9CA3AF] dark:text-[#4B5563] hover:text-[#111827] dark:hover:text-[#E8ECF4] transition-colors focus-visible:ring-2 focus-visible:ring-[#4F8EF7] outline-none"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 20 20"
                fill="currentColor"
                className="h-4 w-4"
                aria-hidden="true"
              >
                <path d="M6.28 5.22a.75.75 0 0 0-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 1 0 1.06 1.06L10 11.06l3.72 3.72a.75.75 0 1 0 1.06-1.06L11.06 10l3.72-3.72a.75.75 0 0 0-1.06-1.06L10 8.94 6.28 5.22Z" />
              </svg>
            </button>
          </div>
        </div>
      )}

      {/* Loading skeleton */}
      {phase.tag === "loading" && <QuizPanelSkeleton />}

      {/* Error state */}
      {phase.tag === "error" && (
        <div className="space-y-3 text-center py-2">
          <p className="text-sm text-[#6B7280] dark:text-[#8B95A8]">
            {phase.message === "seed_too_short"
              ? "Nepietiek satura, lai veidotu jautājumus."
              : phase.message === "quiz_daily_limit_exceeded"
              ? "Šodien esi sasniedzis kviža limitu. Atgriezies rīt vai uzlabo plānu!"
              : "Neizdevās ģenerēt jautājumus. Mēģini vēlreiz."}
          </p>
          {phase.message !== "seed_too_short" &&
            phase.message !== "quiz_daily_limit_exceeded" && (
              <button
                onClick={() => void generate()}
                className="text-sm font-semibold text-[#2563EB] dark:text-[#4F8EF7] hover:underline focus-visible:ring-2 focus-visible:ring-[#4F8EF7] outline-none"
              >
                Mēģināt vēlreiz
              </button>
            )}
        </div>
      )}

      {/* Question */}
      {phase.tag === "answering" &&
        (() => {
          const question = state.questions[phase.questionIndex];
          if (!question || !state.quizId) return null;
          return (
            <QuizQuestionCard
              key={question.id}
              question={question}
              questionIndex={phase.questionIndex}
              total={state.questions.length}
              quizId={state.quizId}
              getIdToken={getIdToken}
              onAnswer={handleAnswer}
            />
          );
        })()}

      {/* Result */}
      {phase.tag === "result" && (
        <QuizResultScreen
          score={phase.score}
          total={phase.total}
          answered={state.answered}
          onClose={handleClose}
        />
      )}
    </div>
  );
}

function QuizPanelSkeleton() {
  return (
    <div className="space-y-3 animate-pulse" aria-label="Ielādē jautājumus...">
      <div className="h-4 rounded-lg bg-[#E5E7EB] dark:bg-white/10 w-3/4" />
      <div className="h-4 rounded-lg bg-[#E5E7EB] dark:bg-white/10 w-1/2" />
      <div className="grid grid-cols-2 gap-2 mt-4">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="h-11 rounded-xl bg-[#E5E7EB] dark:bg-white/10" />
        ))}
      </div>
    </div>
  );
}
