"use client";

import { useState } from "react";

export interface AnsweredQuestion {
  id: string;
  question: string;
  userAnswer: string;
  wasCorrect: boolean;
  explanation: string;
}

interface Props {
  score: number;
  total: number;
  answered: AnsweredQuestion[];
  onClose: () => void;
}

function headline(score: number, total: number): string {
  if (score === total) return "Perfekti! 🎉";
  if (score >= 3) return "Labs darbs! 💪";
  return "Jāpamācās vēl drusku — tas ir OK!";
}

export function QuizResultScreen({ score, total, answered, onClose }: Props) {
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  function toggle(id: string) {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  return (
    <div className="space-y-4 animate-fade-up">
      {/* Score */}
      <div className="text-center py-2">
        <div className="font-[family-name:var(--font-sora)] text-5xl font-bold text-[#111827] dark:text-[#E8ECF4] tabular-nums">
          {score}/{total}
        </div>
        <p className="mt-2 text-sm font-medium text-[#374151] dark:text-[#C9D1E0]">
          {headline(score, total)}
        </p>
      </div>

      {/* Review list */}
      <div className="space-y-2">
        {answered.map((q) => (
          <div
            key={q.id}
            className={`rounded-xl border text-sm overflow-hidden ${
              q.wasCorrect
                ? "border-[#22C55E]/30 bg-[#22C55E]/5"
                : "border-[#F59E0B]/30 bg-[#F59E0B]/5"
            }`}
          >
            <button
              onClick={() => toggle(q.id)}
              aria-expanded={expanded.has(q.id)}
              className="w-full min-h-[44px] flex items-center justify-between gap-3 px-3 py-2.5 text-left focus-visible:ring-2 focus-visible:ring-[#4F8EF7] outline-none"
            >
              <span className="flex items-center gap-2 min-w-0">
                <span
                  className={`shrink-0 font-semibold ${
                    q.wasCorrect ? "text-[#22C55E]" : "text-[#F59E0B]"
                  }`}
                  aria-hidden="true"
                >
                  {q.wasCorrect ? "✓" : "✗"}
                </span>
                <span className="text-[#111827] dark:text-[#E8ECF4] line-clamp-2 leading-snug">
                  {q.question}
                </span>
              </span>
              <svg
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 16 16"
                fill="currentColor"
                className={`h-3.5 w-3.5 shrink-0 text-[#6B7280] dark:text-[#8B95A8] transition-transform ${
                  expanded.has(q.id) ? "rotate-180" : ""
                }`}
                aria-hidden="true"
              >
                <path
                  fillRule="evenodd"
                  d="M4.22 6.22a.75.75 0 0 1 1.06 0L8 8.94l2.72-2.72a.75.75 0 1 1 1.06 1.06l-3.25 3.25a.75.75 0 0 1-1.06 0L4.22 7.28a.75.75 0 0 1 0-1.06Z"
                  clipRule="evenodd"
                />
              </svg>
            </button>

            {expanded.has(q.id) && (
              <div className="px-3 pb-3 pt-0.5 space-y-1.5 text-xs text-[#6B7280] dark:text-[#8B95A8] border-t border-[#E5E7EB]/50 dark:border-white/5">
                <div className="pt-2">
                  <span className="font-medium text-[#374151] dark:text-[#C9D1E0]">
                    Tava atbilde:{" "}
                  </span>
                  <span
                    className={
                      q.wasCorrect ? "text-[#22C55E]" : "text-[#F59E0B]"
                    }
                  >
                    {q.userAnswer}
                  </span>
                </div>
                <div>
                  <span className="font-medium text-[#374151] dark:text-[#C9D1E0]">
                    Paskaidrojums:{" "}
                  </span>
                  {q.explanation}
                </div>
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Close */}
      <button
        onClick={onClose}
        className="w-full min-h-[44px] rounded-xl border border-[#E5E7EB] dark:border-white/7 bg-white/50 dark:bg-[#1A2033]/50 text-sm font-semibold text-[#111827] dark:text-[#E8ECF4] transition-all hover:bg-[#F1F5F9] dark:hover:bg-[#1A2033] focus-visible:ring-2 focus-visible:ring-[#4F8EF7] outline-none"
      >
        Aizvērt
      </button>
    </div>
  );
}
