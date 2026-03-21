import OpenAI from "openai";
import Anthropic from "@anthropic-ai/sdk";

// Toggle: true = Claude Sonnet (paid tier testing), false = DeepSeek V3 (free tier)
// TODO: replace with subscription check (isPaidUser) once Stripe is wired up
const USE_CLAUDE = true;

// DeepSeek exposes an OpenAI-compatible API
const deepseekClient = new OpenAI({
  apiKey: process.env.DEEPSEEK_API_KEY ?? "",
  baseURL: process.env.DEEPSEEK_BASE_URL ?? "https://api.deepseek.com",
});

const anthropicClient = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY ?? "",
});

export const DEEPSEEK_MODEL = "deepseek-chat"; // DeepSeek V3.2 — $0.07/1M cached, $0.27/1M input, $1.10/1M output
export const CLAUDE_MODEL = "claude-sonnet-4-20250514";

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
  if (USE_CLAUDE) {
    const systemMsg = messages.find((m) => m.role === "system")?.content;
    const userMessages = messages
      .filter((m) => m.role !== "system")
      .map((m) => ({ role: m.role as "user" | "assistant", content: m.content }));

    const response = await anthropicClient.messages.create({
      model: CLAUDE_MODEL,
      max_tokens: 600,
      temperature,
      ...(systemMsg ? { system: systemMsg } : {}),
      messages: userMessages,
    });

    const textBlock = response.content.find((b) => b.type === "text");
    return {
      content: textBlock?.type === "text" ? textBlock.text : "",
      usage: {
        prompt_tokens: response.usage.input_tokens,
        completion_tokens: response.usage.output_tokens,
        total_tokens: response.usage.input_tokens + response.usage.output_tokens,
      },
    };
  }

  const response = await deepseekClient.chat.completions.create({
    model: DEEPSEEK_MODEL,
    messages,
    temperature,
    max_tokens: 600,
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
  if (USE_CLAUDE) {
    const systemMsg = messages.find((m) => m.role === "system")?.content;
    const userMessages = messages
      .filter((m) => m.role !== "system")
      .map((m) => ({ role: m.role as "user" | "assistant", content: m.content }));

    const stream = anthropicClient.messages.stream({
      model: CLAUDE_MODEL,
      max_tokens: 600,
      temperature,
      ...(systemMsg ? { system: systemMsg } : {}),
      messages: userMessages,
    });

    for await (const event of stream) {
      if (
        event.type === "content_block_delta" &&
        event.delta.type === "text_delta"
      ) {
        yield event.delta.text;
      }
    }
    return;
  }

  const stream = await deepseekClient.chat.completions.create({
    model: DEEPSEEK_MODEL,
    messages,
    temperature,
    max_tokens: 600,
    stream: true,
  });

  for await (const chunk of stream) {
    const delta = chunk.choices[0]?.delta?.content;
    if (delta) yield delta;
  }
}
