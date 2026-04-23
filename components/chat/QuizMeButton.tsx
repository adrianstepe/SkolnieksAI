"use client";

import { Sparkles } from "lucide-react";
import { isQuizEnabled } from "@/lib/features";

export function QuizMeButton({
  onClick,
  disabled,
}: {
  onClick: () => void;
  disabled?: boolean;
}) {
  if (!isQuizEnabled()) return null;

  return (
    <button
      onClick={onClick}
      disabled={disabled}
      aria-label="Sākt pašpārbaudi"
      className="inline-flex min-h-[44px] sm:min-h-0 items-center gap-1.5 rounded-full bg-[#2563EB]/10 dark:bg-[#4F8EF7]/10 px-3 py-1 text-xs font-semibold text-[#2563EB] dark:text-[#4F8EF7] transition-all hover:bg-[#2563EB]/15 dark:hover:bg-[#4F8EF7]/20 disabled:opacity-50 disabled:cursor-not-allowed focus-visible:ring-2 focus-visible:ring-[#4F8EF7] outline-none"
    >
      <Sparkles className="h-3 w-3" aria-hidden="true" />
      Pārbaudi mani
    </button>
  );
}
