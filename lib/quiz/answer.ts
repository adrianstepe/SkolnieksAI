/* eslint-disable @typescript-eslint/no-unused-vars */
import type { QuizAnswerResponse } from "./types";

export async function answerQuestion(
  _uid: string,
  _quizId: string,
  _questionId: string,
  _userAnswer: string,
  _tier: string,
): Promise<QuizAnswerResponse> {
  throw new Error("not implemented");
}
