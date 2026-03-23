"use client";

import {
  Calculator,
  FlaskConical,
  FlaskRound,
  BookOpen,
  History,
  Globe,
  Languages,
  ALargeSmall,
  Code2,
  Palette,
  MessageSquare,
  type LucideIcon,
} from "lucide-react";

export const SUBJECTS: {
  value: string;
  label: string;
  shortLabel: string;
  icon: LucideIcon;
}[] = [
  { value: "general", label: "Vispārīgi", shortLabel: "Vispārīgi", icon: MessageSquare },
  { value: "math", label: "Matemātika", shortLabel: "Matemātika", icon: Calculator },
  { value: "physics", label: "Fizika", shortLabel: "Fizika", icon: FlaskConical },
  { value: "chemistry", label: "Ķīmija", shortLabel: "Ķīmija", icon: FlaskRound },
  { value: "biology", label: "Bioloģija", shortLabel: "Bioloģija", icon: BookOpen },
  { value: "history", label: "Vēsture", shortLabel: "Vēsture", icon: History },
  { value: "geography", label: "Ģeogrāfija", shortLabel: "Ģeogrāfija", icon: Globe },
  { value: "latvian", label: "Latviešu valoda", shortLabel: "Latviešu val.", icon: Languages },
  { value: "english", label: "Angļu valoda", shortLabel: "Angļu val.", icon: ALargeSmall },
  { value: "informatics", label: "Datorzinātne", shortLabel: "Datorzinātne", icon: Code2 },
  { value: "art", label: "Vizuālā māksla", shortLabel: "Vizuālā māksla", icon: Palette },
] as const;

export const GRADES = [6, 7, 8, 9, 10, 11, 12] as const;

interface SubjectGradeSelectorProps {
  subject: string;
  grade: number;
  onSubjectChange: (subject: string) => void;
  onGradeChange: (grade: number) => void;
}

export function SubjectGradeSelector({
  subject,
  grade,
  onSubjectChange,
  onGradeChange,
}: SubjectGradeSelectorProps) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <select
        value={subject}
        onChange={(e) => onSubjectChange(e.target.value)}
        className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-700 focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-200"
      >
        {SUBJECTS.map((s) => (
          <option key={s.value} value={s.value}>
            {s.label}
          </option>
        ))}
      </select>

      <div className="flex gap-1">
        {GRADES.map((g) => (
          <button
            key={g}
            onClick={() => onGradeChange(g)}
            className={`rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
              grade === g
                ? "bg-brand-600 text-white"
                : "bg-white border border-gray-200 text-gray-600 hover:bg-gray-50 dark:bg-slate-700 dark:border-slate-600 dark:text-slate-300 dark:hover:bg-slate-600"
            }`}
          >
            {g}.
          </button>
        ))}
      </div>
    </div>
  );
}
