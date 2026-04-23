import { describe, it, expect } from "vitest";
import { quizReducer, type QuizPanelState, type QuizAction } from "./QuizPanel";
import type { QuizGenerateResponseQuestion } from "@/lib/quiz/types";

const Q1: QuizGenerateResponseQuestion = {
  id: "q_0",
  type: "multiple_choice",
  question: "Kas ir fotosintēze?",
  choices: ["A", "B", "C", "D"],
};

const Q2: QuizGenerateResponseQuestion = {
  id: "q_1",
  type: "open_ended",
  question: "Kāds ir ūdens ķīmiskais simbols?",
  choices: null,
};

const IDLE: QuizPanelState = {
  phase: { tag: "idle" },
  quizId: null,
  questions: [],
  answered: [],
};

function dispatch(state: QuizPanelState, action: QuizAction): QuizPanelState {
  return quizReducer(state, action);
}

describe("quizReducer", () => {
  it("START → loading", () => {
    const next = dispatch(IDLE, { type: "START" });
    expect(next.phase.tag).toBe("loading");
    expect(next.questions).toHaveLength(0);
    expect(next.answered).toHaveLength(0);
  });

  it("LOADED → answering at index 0", () => {
    const loading: QuizPanelState = { ...IDLE, phase: { tag: "loading" } };
    const next = dispatch(loading, {
      type: "LOADED",
      quizId: "quiz_abc",
      questions: [Q1, Q2],
    });
    expect(next.phase).toEqual({ tag: "answering", questionIndex: 0 });
    expect(next.quizId).toBe("quiz_abc");
    expect(next.questions).toHaveLength(2);
  });

  it("ERROR → error phase", () => {
    const loading: QuizPanelState = { ...IDLE, phase: { tag: "loading" } };
    const next = dispatch(loading, {
      type: "ERROR",
      message: "generation_failed",
    });
    expect(next.phase).toEqual({ tag: "error", message: "generation_failed" });
  });

  it("ANSWER (not complete) → advances questionIndex", () => {
    const answering: QuizPanelState = {
      phase: { tag: "answering", questionIndex: 0 },
      quizId: "quiz_abc",
      questions: [Q1, Q2],
      answered: [],
    };
    const next = dispatch(answering, {
      type: "ANSWER",
      answered: {
        id: "q_0",
        question: Q1.question,
        userAnswer: "A",
        wasCorrect: true,
        explanation: "Tā ir.",
      },
      isComplete: false,
    });
    expect(next.phase).toEqual({ tag: "answering", questionIndex: 1 });
    expect(next.answered).toHaveLength(1);
  });

  it("ANSWER (complete) → result phase with score", () => {
    const answering: QuizPanelState = {
      phase: { tag: "answering", questionIndex: 1 },
      quizId: "quiz_abc",
      questions: [Q1, Q2],
      answered: [
        {
          id: "q_0",
          question: Q1.question,
          userAnswer: "A",
          wasCorrect: true,
          explanation: "Tā ir.",
        },
      ],
    };
    const next = dispatch(answering, {
      type: "ANSWER",
      answered: {
        id: "q_1",
        question: Q2.question,
        userAnswer: "H2O",
        wasCorrect: true,
        explanation: "Pareizi.",
      },
      isComplete: true,
      score: 2,
    });
    expect(next.phase).toEqual({ tag: "result", score: 2, total: 2 });
    expect(next.answered).toHaveLength(2);
  });

  it("CLOSE → resets to idle", () => {
    const result: QuizPanelState = {
      phase: { tag: "result", score: 2, total: 2 },
      quizId: "quiz_abc",
      questions: [Q1, Q2],
      answered: [
        {
          id: "q_0",
          question: Q1.question,
          userAnswer: "A",
          wasCorrect: true,
          explanation: "Tā ir.",
        },
        {
          id: "q_1",
          question: Q2.question,
          userAnswer: "H2O",
          wasCorrect: true,
          explanation: "Pareizi.",
        },
      ],
    };
    const next = dispatch(result, { type: "CLOSE" });
    expect(next.phase.tag).toBe("idle");
    expect(next.quizId).toBeNull();
    expect(next.questions).toHaveLength(0);
    expect(next.answered).toHaveLength(0);
  });

  it("RESTORE (in progress) → answering at nextIndex", () => {
    const next = dispatch(IDLE, {
      type: "RESTORE",
      quizId: "quiz_xyz",
      questions: [Q1, Q2],
      answered: [
        {
          id: "q_0",
          question: Q1.question,
          userAnswer: "B",
          wasCorrect: false,
          explanation: "Ne gluži.",
        },
      ],
      nextIndex: 1,
    });
    expect(next.phase).toEqual({ tag: "answering", questionIndex: 1 });
    expect(next.answered).toHaveLength(1);
  });

  it("RESTORE (complete) → result phase", () => {
    const next = dispatch(IDLE, {
      type: "RESTORE",
      quizId: "quiz_xyz",
      questions: [Q1, Q2],
      answered: [
        {
          id: "q_0",
          question: Q1.question,
          userAnswer: "A",
          wasCorrect: true,
          explanation: "Tā ir.",
        },
        {
          id: "q_1",
          question: Q2.question,
          userAnswer: "H2O",
          wasCorrect: true,
          explanation: "Pareizi.",
        },
      ],
      nextIndex: 0,
      result: { score: 2, total: 2 },
    });
    expect(next.phase).toEqual({ tag: "result", score: 2, total: 2 });
  });
});
