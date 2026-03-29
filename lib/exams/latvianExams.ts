// TODO: Update with official VISC centralized exam schedule when published for 2026.
// Dates below are approximate based on the historical late-May / early-June window.
// Official schedule: https://www.visc.gov.lv/lv/centralizeto-eksamen-grafiks

export const LATVIAN_EXAM_DATES_2026: Date[] = [
  new Date("2026-05-20"), // First CE date (approximate — verify with VISC)
  new Date("2026-05-25"),
  new Date("2026-05-28"),
  new Date("2026-06-02"),
  new Date("2026-06-05"),
];

/**
 * Keywords that suggest the user's message is related to exam topics.
 * Used for the contextual upgrade prompt in the chat UI.
 * Matching is case-insensitive, substring-based.
 */
export const EXAM_UPGRADE_KEYWORDS: string[] = [
  "eksāmens",
  "eksāmenam",
  "algebr",
  "kvadrātvienādojum",
  "ģeometrij",
  "latvijas vēstur",
  "literatūr",
];

/**
 * Normalize a string by stripping Latvian diacritics so that e.g. "eksāmens"
 * matches when the user types "eksamens" (common on mobile keyboards).
 *
 * Standard NFD handles ā→a, ē→e, ī→i, ū→u but not the Latvian cedilla
 * characters ģ, ķ, ļ, ņ which are separate Unicode code points.
 */
export function normalizeLv(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/ģ/g, "g")
    .replace(/ķ/g, "k")
    .replace(/ļ/g, "l")
    .replace(/ņ/g, "n");
}

/**
 * Returns countdown info for grades 9 and 12 only.
 * Returns null for all other grades, or when no future exam dates exist.
 *
 * @param grade - The student's current grade (6–12)
 */
export function getExamCountdown(
  grade: number,
): { daysRemaining: number; label: string } | null {
  if (grade !== 9 && grade !== 12) return null;

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const msPerDay = 1000 * 60 * 60 * 24;

  const nearestFuture = LATVIAN_EXAM_DATES_2026.find((d) => d >= today);
  if (!nearestFuture) return null;

  const daysRemaining = Math.ceil(
    (nearestFuture.getTime() - today.getTime()) / msPerDay,
  );

  const label =
    grade === 9 ? "Līdz 9. klases eksāmeniem" : "Līdz 12. klases eksāmeniem";

  return { daysRemaining, label };
}
