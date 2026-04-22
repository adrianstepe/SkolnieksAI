import { vi, describe, it, expect, beforeEach } from "vitest";
import { generateQuiz, QuizGenerationError } from "./generate";

// vi.hoisted ensures these are available inside vi.mock factories (which are hoisted)
const mockChat = vi.hoisted(() => vi.fn());
const mockFirestoreSet = vi.hoisted(() => vi.fn().mockResolvedValue(undefined));

vi.mock("@/lib/ai/deepseek", () => ({ chat: mockChat }));

vi.mock("firebase-admin/firestore", () => ({
  FieldValue: { increment: (n: number) => n },
}));

vi.mock("@/lib/firebase/admin", () => {
  // Returns an object that handles the full collection().doc().collection().doc() chain
  const makeRef = (): {
    id: string;
    set: typeof mockFirestoreSet;
    collection: () => { doc: () => ReturnType<typeof makeRef> };
  } => ({
    id: "mock_quiz_id",
    set: mockFirestoreSet,
    collection: () => ({ doc: () => makeRef() }),
  });

  return {
    adminDb: {
      collection: () => ({ doc: () => makeRef() }),
    },
  };
});

const VALID_LLM_RESPONSE = JSON.stringify({
  questions: [
    {
      type: "multiple_choice",
      question: "Kas ir fotosintēze?",
      choices: ["Enerģijas ražošana no gaismas", "B", "C", "D"],
      correctIndex: 0,
      explanation: "Fotosintēze ir process, kurā augi ražo enerģiju no gaismas.",
      wrongExplanations: { B: "Nav pareizs.", C: "Nav pareizs.", D: "Nav pareizs." },
    },
    {
      type: "open_ended",
      question: "Kāda viela absorbē gaismu fotosintēzē?",
      correctAnswer: "Hlorofils",
      explanation: "Hlorofils absorbē gaismu un pārvērš to ķīmiskajā enerģijā.",
    },
  ],
});

const QUIZ_PARAMS = {
  seedMessage:
    "Fotosintēze ir process, kurā augi izmanto saules gaismu, ūdeni un CO2, lai ražotu cukuru un skābekli.",
  recentContext: "Skolēns: Kas ir fotosintēze?\nAI: Fotosintēze ir...",
  subject: "biology",
  grade: 8,
};

const MOCK_USAGE = { prompt_tokens: 100, completion_tokens: 200, total_tokens: 300 };

describe("generateQuiz", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFirestoreSet.mockResolvedValue(undefined);
  });

  it("happy path: valid JSON → quiz persisted → response shape correct", async () => {
    mockChat.mockResolvedValue({ content: VALID_LLM_RESPONSE, usage: MOCK_USAGE });

    const result = await generateQuiz("uid1", "conv1", "msg1", "free", QUIZ_PARAMS);

    expect(result.quizId).toBe("mock_quiz_id");
    expect(result.questions).toHaveLength(2);

    const q0 = result.questions[0]!;
    expect(q0).toMatchObject({
      id: "q_0",
      type: "multiple_choice",
      question: "Kas ir fotosintēze?",
      choices: ["Enerģijas ražošana no gaismas", "B", "C", "D"],
    });
    // correctAnswer and explanation must NOT be in the public response
    expect((q0 as Record<string, unknown>).correctAnswer).toBeUndefined();
    expect((q0 as Record<string, unknown>).explanation).toBeUndefined();

    const q1 = result.questions[1]!;
    expect(q1).toMatchObject({ id: "q_1", type: "open_ended", choices: null });

    // quiz doc + usage doc both persisted
    expect(mockFirestoreSet).toHaveBeenCalledTimes(2);
    // chat called exactly once (no retry needed)
    expect(mockChat).toHaveBeenCalledTimes(1);
  });

  it("paid tier uses claude model", async () => {
    mockChat.mockResolvedValue({ content: VALID_LLM_RESPONSE, usage: MOCK_USAGE });

    await generateQuiz("uid1", "conv1", "msg1", "pro", QUIZ_PARAMS);

    const [, , modelArg] = mockChat.mock.calls[0] as [unknown, unknown, string];
    expect(modelArg).toBe("claude");
  });

  it("free tier uses deepseek model", async () => {
    mockChat.mockResolvedValue({ content: VALID_LLM_RESPONSE, usage: MOCK_USAGE });

    await generateQuiz("uid1", "conv1", "msg1", "free", QUIZ_PARAMS);

    const [, , modelArg] = mockChat.mock.calls[0] as [unknown, unknown, string];
    expect(modelArg).toBe("deepseek");
  });

  it("malformed JSON on first attempt → retries → second valid → succeeds", async () => {
    mockChat
      .mockResolvedValueOnce({ content: "This is not JSON at all", usage: MOCK_USAGE })
      .mockResolvedValueOnce({ content: VALID_LLM_RESPONSE, usage: MOCK_USAGE });

    const result = await generateQuiz("uid1", "conv1", "msg1", "free", QUIZ_PARAMS);

    expect(result.quizId).toBeDefined();
    expect(result.questions).toHaveLength(2);
    expect(mockChat).toHaveBeenCalledTimes(2);

    // Retry message should include the correction instruction
    const retryMessages = mockChat.mock.calls[1]![0] as Array<{ role: string; content: string }>;
    const lastMsg = retryMessages[retryMessages.length - 1]!;
    expect(lastMsg.role).toBe("user");
    expect(lastMsg.content).toContain("Iepriekšējā atbilde nebija derīgs JSON");
  });

  it("malformed JSON on both attempts → throws QuizGenerationError", async () => {
    mockChat.mockResolvedValue({ content: "not json", usage: MOCK_USAGE });

    await expect(
      generateQuiz("uid1", "conv1", "msg1", "free", QUIZ_PARAMS),
    ).rejects.toThrow(QuizGenerationError);

    expect(mockChat).toHaveBeenCalledTimes(2);
    // Nothing should be persisted
    expect(mockFirestoreSet).not.toHaveBeenCalled();
  });

  it("valid JSON wrapped in ```json fences is stripped and parsed", async () => {
    const fenced = `\`\`\`json\n${VALID_LLM_RESPONSE}\n\`\`\``;
    mockChat.mockResolvedValue({ content: fenced, usage: MOCK_USAGE });

    const result = await generateQuiz("uid1", "conv1", "msg1", "free", QUIZ_PARAMS);
    expect(result.questions).toHaveLength(2);
  });
});
