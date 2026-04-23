// @vitest-environment jsdom
import { vi, describe, it, expect, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, waitFor, cleanup } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import { QuizQuestionCard } from "./QuizQuestionCard";
import type { QuizGenerateResponseQuestion } from "@/lib/quiz/types";

const MC_QUESTION: QuizGenerateResponseQuestion = {
  id: "q_0",
  type: "multiple_choice",
  question: "Kas ir fotosintēze?",
  choices: ["Gaismas reakcija", "Cukura sintēze", "Ūdens sadalīšana", "Skābekļa absorbcija"],
};

const OE_QUESTION: QuizGenerateResponseQuestion = {
  id: "q_1",
  type: "open_ended",
  question: "Kāds ir ūdens ķīmiskais simbols?",
  choices: null,
};

const ANSWER_RESPONSE = {
  wasCorrect: true,
  explanation: "Pareizi, fotosintēze ir process.",
  isComplete: false,
};

const mockGetIdToken = vi.fn().mockResolvedValue("test-token");
const mockOnAnswer = vi.fn();

function mockFetch(body: unknown, ok = true) {
  vi.stubGlobal(
    "fetch",
    vi.fn().mockResolvedValue({
      ok,
      json: () => Promise.resolve(body),
    } as unknown as Response),
  );
}

beforeEach(() => {
  mockFetch(ANSWER_RESPONSE);
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});

describe("QuizQuestionCard — multiple choice", () => {
  it("renders question text and four choices", () => {
    render(
      <QuizQuestionCard
        question={MC_QUESTION}
        questionIndex={0}
        total={5}
        quizId="quiz_abc"
        getIdToken={mockGetIdToken}
        onAnswer={mockOnAnswer}
      />,
    );

    expect(screen.getByText("Kas ir fotosintēze?")).toBeInTheDocument();
    expect(screen.getByText("Gaismas reakcija")).toBeInTheDocument();
    expect(screen.getByText("Cukura sintēze")).toBeInTheDocument();
    expect(screen.getByText("Ūdens sadalīšana")).toBeInTheDocument();
    expect(screen.getByText("Skābekļa absorbcija")).toBeInTheDocument();
  });

  it("clicking a choice submits and shows feedback", async () => {
    render(
      <QuizQuestionCard
        question={MC_QUESTION}
        questionIndex={0}
        total={5}
        quizId="quiz_abc"
        getIdToken={mockGetIdToken}
        onAnswer={mockOnAnswer}
      />,
    );

    fireEvent.click(screen.getByText("Gaismas reakcija"));

    await waitFor(() => {
      expect(screen.getAllByText(/Pareizi/).length).toBeGreaterThan(0);
    });

    expect(global.fetch).toHaveBeenCalledWith(
      "/api/quiz/answer",
      expect.objectContaining({
        method: "POST",
        body: expect.stringContaining('"userAnswer":"Gaismas reakcija"'),
      }),
    );
  });

  it("shows 'Nākamais' button after answer, calls onAnswer on click", async () => {
    render(
      <QuizQuestionCard
        question={MC_QUESTION}
        questionIndex={0}
        total={5}
        quizId="quiz_abc"
        getIdToken={mockGetIdToken}
        onAnswer={mockOnAnswer}
      />,
    );

    fireEvent.click(screen.getByText("Cukura sintēze"));

    await waitFor(() => {
      expect(screen.getByText("Nākamais →")).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText("Nākamais →"));
    expect(mockOnAnswer).toHaveBeenCalledOnce();
  });

  it("shows 'Redzēt rezultātu' on the last question", async () => {
    render(
      <QuizQuestionCard
        question={MC_QUESTION}
        questionIndex={4}
        total={5}
        quizId="quiz_abc"
        getIdToken={mockGetIdToken}
        onAnswer={mockOnAnswer}
      />,
    );

    fireEvent.click(screen.getByText("Gaismas reakcija"));

    await waitFor(() => {
      expect(screen.getByText("Redzēt rezultātu")).toBeInTheDocument();
    });
  });
});

describe("QuizQuestionCard — open ended", () => {
  it("renders input and submit button", () => {
    render(
      <QuizQuestionCard
        question={OE_QUESTION}
        questionIndex={0}
        total={5}
        quizId="quiz_abc"
        getIdToken={mockGetIdToken}
        onAnswer={mockOnAnswer}
      />,
    );

    expect(screen.getByPlaceholderText("Tava atbilde...")).toBeInTheDocument();
    expect(screen.getByText("Pārbaudīt")).toBeInTheDocument();
  });

  it("submits via button click and shows feedback", async () => {
    render(
      <QuizQuestionCard
        question={OE_QUESTION}
        questionIndex={0}
        total={5}
        quizId="quiz_abc"
        getIdToken={mockGetIdToken}
        onAnswer={mockOnAnswer}
      />,
    );

    const input = screen.getByPlaceholderText("Tava atbilde...");
    fireEvent.change(input, { target: { value: "H2O" } });
    fireEvent.click(screen.getByText("Pārbaudīt"));

    await waitFor(() => {
      expect(screen.getAllByText(/Pareizi/).length).toBeGreaterThan(0);
    });
  });

  it("submit button is disabled when input is empty", () => {
    render(
      <QuizQuestionCard
        question={OE_QUESTION}
        questionIndex={0}
        total={5}
        quizId="quiz_abc"
        getIdToken={mockGetIdToken}
        onAnswer={mockOnAnswer}
      />,
    );

    expect(screen.getByText("Pārbaudīt")).toBeDisabled();
  });
});
