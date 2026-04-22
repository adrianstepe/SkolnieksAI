export function isQuizEnabled(): boolean {
  return process.env.NEXT_PUBLIC_QUIZ_ENABLED === "true";
}
