/* eslint-disable @typescript-eslint/no-unused-vars */
export function buildQuizGenerationPrompt(_params: {
  subject: string;
  grade: number;
  seedMessage: string;
  recentContext: string;
  desiredCount: number;
}): { system: string; user: string } {
  throw new Error("not implemented");
}

export function buildOpenEndedGradingPrompt(_params: {
  question: string;
  correctAnswer: string;
  userAnswer: string;
  subject: string;
  grade: number;
}): { system: string; user: string } {
  throw new Error("not implemented");
}
