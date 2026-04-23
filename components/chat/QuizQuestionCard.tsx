"use client";

import { useState, useRef } from "react";
import type { QuizGenerateResponseQuestion } from "@/lib/quiz/types";

export interface AnswerCallbackData {
  userAnswer: string;
  wasCorrect: boolean;
  explanation: string;
  isComplete: boolean;
  score?: number;
}

interface Props {
  question: QuizGenerateResponseQuestion;
  questionIndex: number;
  total: number;
  quizId: string;
  getIdToken: () => Promise<string | null>;
  onAnswer: (data: AnswerCallbackData) => void;
}

export function QuizQuestionCard({
  question,
  questionIndex,
  total,
  quizId,
  getIdToken,
  onAnswer,
}: Props) {
  const [selected, setSelected] = useState<string | null>(null);
  const [openAnswer, setOpenAnswer] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<AnswerCallbackData | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const isLast = questionIndex === total - 1;

  async function submit(answer: string) {
    if (submitting || result) return;
    const trimmed = answer.trim().slice(0, 500);
    if (!trimmed) return;
    setSubmitting(true);
    try {
      const token = await getIdToken();
      const res = await fetch("/api/quiz/answer", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          quizId,
          questionId: question.id,
          userAnswer: trimmed,
        }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = (await res.json()) as {
        wasCorrect: boolean;
        explanation: string;
        isComplete: boolean;
        score?: number;
      };
      setResult({ userAnswer: trimmed, ...data });
    } catch {
      // silent — user can retry by clicking again
    } finally {
      setSubmitting(false);
    }
  }

  function handleMCSelect(choice: string) {
    if (result || submitting) return;
    setSelected(choice);
    void submit(choice);
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter") void submit(openAnswer);
  }

  return (
    <div className="space-y-3 animate-fade-up">
      <p
        id={`q-${question.id}`}
        className="text-sm font-medium text-[#111827] dark:text-[#E8ECF4] leading-relaxed"
      >
        {question.question}
      </p>

      {question.type === "multiple_choice" && question.choices ? (
        <div
          role="radiogroup"
          aria-labelledby={`q-${question.id}`}
          className="grid grid-cols-1 sm:grid-cols-2 gap-2"
        >
          {question.choices.map((choice) => {
            const isSelected = selected === choice;
            const isCorrect = !!(result?.wasCorrect && isSelected);
            const isWrong = !!(result && !result.wasCorrect && isSelected);

            return (
              <button
                key={choice}
                role="radio"
                aria-checked={isSelected}
                onClick={() => handleMCSelect(choice)}
                disabled={!!result || submitting}
                className={`min-h-[44px] text-left px-3 py-2.5 rounded-xl border text-sm transition-all focus-visible:ring-2 focus-visible:ring-[#4F8EF7] outline-none disabled:cursor-default ${
                  isCorrect
                    ? "border-[#22C55E] bg-[#22C55E]/10 text-[#22C55E]"
                    : isWrong
                    ? "border-[#F59E0B] bg-[#F59E0B]/10 text-[#F59E0B]"
                    : isSelected
                    ? "border-[#2563EB] dark:border-[#4F8EF7] bg-[#2563EB]/10 dark:bg-[#4F8EF7]/10 text-[#2563EB] dark:text-[#4F8EF7]"
                    : "border-[#E5E7EB] dark:border-white/7 bg-white dark:bg-[#0F1117]/50 text-[#374151] dark:text-[#C9D1E0] hover:border-[#2563EB]/40 dark:hover:border-[#4F8EF7]/40"
                }`}
              >
                <span className="flex items-center gap-2 break-words">
                  {isCorrect && (
                    <span className="shrink-0" aria-hidden="true">
                      ✓
                    </span>
                  )}
                  {isWrong && (
                    <span className="shrink-0" aria-hidden="true">
                      ✗
                    </span>
                  )}
                  {choice}
                </span>
              </button>
            );
          })}
        </div>
      ) : (
        <div className="flex flex-col sm:flex-row gap-2">
          <label htmlFor={`open-${question.id}`} className="sr-only">
            {question.question}
          </label>
          <input
            id={`open-${question.id}`}
            ref={inputRef}
            type="text"
            value={openAnswer}
            onChange={(e) => setOpenAnswer(e.target.value)}
            onKeyDown={handleKeyDown}
            disabled={!!result || submitting}
            maxLength={500}
            placeholder="Tava atbilde..."
            className="flex-1 min-h-[44px] rounded-xl border border-[#E5E7EB] dark:border-white/7 bg-white dark:bg-[#0F1117]/50 px-3 py-2 text-sm text-[#111827] dark:text-[#E8ECF4] placeholder-[#9CA3AF] dark:placeholder-[#4B5563] focus:border-[#2563EB] dark:focus:border-[#4F8EF7] focus:outline-none focus:ring-1 focus:ring-[#2563EB] dark:focus:ring-[#4F8EF7] disabled:opacity-50 transition-colors"
          />
          <button
            onClick={() => void submit(openAnswer)}
            disabled={!!result || submitting || !openAnswer.trim()}
            className="min-h-[44px] px-4 rounded-xl bg-[#2563EB] dark:bg-[#4F8EF7] text-white text-sm font-semibold transition-all hover:bg-[#1D4ED8] dark:hover:bg-[#3D7CE5] disabled:opacity-50 disabled:cursor-not-allowed focus-visible:ring-2 focus-visible:ring-[#4F8EF7] outline-none"
          >
            {submitting ? "…" : "Pārbaudīt"}
          </button>
        </div>
      )}

      {/* Inline feedback */}
      {result && (
        <div
          aria-live="polite"
          className={`rounded-xl px-3 py-2.5 text-sm leading-relaxed ${
            result.wasCorrect
              ? "bg-[#22C55E]/10 text-[#22C55E]"
              : "bg-[#F59E0B]/10 text-[#F59E0B]"
          }`}
        >
          <span className="font-semibold">
            {result.wasCorrect ? "✓ Pareizi." : "Ne gluži."}
          </span>{" "}
          {result.explanation}
        </div>
      )}

      {/* Advance button */}
      {result && (
        <button
          onClick={() => onAnswer(result)}
          className="w-full min-h-[44px] rounded-xl border border-[#E5E7EB] dark:border-white/7 bg-white/50 dark:bg-[#1A2033]/50 text-sm font-semibold text-[#111827] dark:text-[#E8ECF4] transition-all hover:bg-[#F1F5F9] dark:hover:bg-[#1A2033] focus-visible:ring-2 focus-visible:ring-[#4F8EF7] outline-none"
        >
          {isLast ? "Redzēt rezultātu" : "Nākamais →"}
        </button>
      )}
    </div>
  );
}
