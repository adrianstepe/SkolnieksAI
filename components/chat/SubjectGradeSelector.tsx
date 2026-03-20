"use client";

export const SUBJECTS = [
  { value: "math", label: "Matem\u0101tika" },
  { value: "latvian", label: "Latvie\u0161u valoda" },
  { value: "english", label: "Ang\u013Cu valoda" },
  { value: "science", label: "Dabaszin\u012Bbas" },
  { value: "history", label: "V\u0113sture" },
  { value: "social_studies", label: "Soci\u0101l\u0101s zin\u012Bbas" },
  { value: "physics", label: "Fizika" },
  { value: "chemistry", label: "\u0136\u012Bmija" },
  { value: "biology", label: "Biolo\u0123ija" },
  { value: "informatics", label: "Inform\u0101tika" },
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
        className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-700 focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
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
                : "bg-white border border-gray-200 text-gray-600 hover:bg-gray-50"
            }`}
          >
            {g}.
          </button>
        ))}
      </div>
    </div>
  );
}
