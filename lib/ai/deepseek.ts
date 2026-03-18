import OpenAI from "openai";

// DeepSeek exposes an OpenAI-compatible API
const client = new OpenAI({
  apiKey: process.env.DEEPSEEK_API_KEY ?? "",
  baseURL: process.env.DEEPSEEK_BASE_URL ?? "https://api.deepseek.com",
});

export const DEEPSEEK_MODEL = "deepseek-chat"; // DeepSeek V3.2

export interface ChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export interface DeepSeekResponse {
  content: string;
  usage: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
}

/**
 * Single-shot chat completion (non-streaming).
 * Used by the RAG chain and the eval script.
 */
export async function chat(
  messages: ChatMessage[],
  temperature = 0.3,
): Promise<DeepSeekResponse> {
  const response = await client.chat.completions.create({
    model: DEEPSEEK_MODEL,
    messages,
    temperature,
    stream: false,
  });

  const choice = response.choices[0];
  return {
    content: choice.message.content ?? "",
    usage: {
      prompt_tokens: response.usage?.prompt_tokens ?? 0,
      completion_tokens: response.usage?.completion_tokens ?? 0,
      total_tokens: response.usage?.total_tokens ?? 0,
    },
  };
}

/**
 * Streaming chat completion. Yields text delta chunks.
 * Used by the /api/chat route to stream responses to the browser.
 */
export async function* chatStream(
  messages: ChatMessage[],
  temperature = 0.3,
): AsyncGenerator<string> {
  const stream = await client.chat.completions.create({
    model: DEEPSEEK_MODEL,
    messages,
    temperature,
    stream: true,
  });

  for await (const chunk of stream) {
    const delta = chunk.choices[0]?.delta?.content;
    if (delta) yield delta;
  }
}
