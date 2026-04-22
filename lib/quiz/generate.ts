/* eslint-disable @typescript-eslint/no-unused-vars */
import type { QuizGenerateResponse } from "./types";

export async function generateQuiz(
  _uid: string,
  _conversationId: string,
  _messageId: string,
  _tier: string,
): Promise<QuizGenerateResponse> {
  throw new Error("not implemented");
}
