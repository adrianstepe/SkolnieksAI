import OpenAI from "openai";
import Anthropic from "@anthropic-ai/sdk";

export type AiModelChoice = "deepseek" | "claude";

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
  model: AiModelChoice = "deepseek",
  maxTokens = 800,
): Promise<DeepSeekResponse> {
  if (model === "claude") {
    const systemMsg = messages.find((m) => m.role === "system")?.content;
    const userMessages = messages
      .filter((m) => m.role !== "system")
      .map((m) => ({ role: m.role as "user" | "assistant", content: m.content }));

    const response = await anthropicClient.messages.create({
      model: CLAUDE_MODEL,
      max_tokens: maxTokens,
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
    max_tokens: maxTokens,
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

export interface StreamUsage {
  prompt_tokens: number;
  completion_tokens: number;
  total_tokens: number;
}

export interface ChatStreamResult {
  stream: AsyncGenerator<string>;
  getUsage: () => StreamUsage;
}

/**
 * Streaming chat completion. Returns a stream of text deltas and a
 * getUsage() function that returns actual token counts after the stream ends.
 */
export function chatStream(
  messages: ChatMessage[],
  temperature = 0.3,
  model: AiModelChoice = "deepseek",
  maxTokens = 800,
): ChatStreamResult {
  const usage: StreamUsage = { prompt_tokens: 0, completion_tokens: 0, total_tokens: 0 };

  async function* generate(): AsyncGenerator<string> {
    if (model === "claude") {
      const systemMsg = messages.find((m) => m.role === "system")?.content;
      const userMessages = messages
        .filter((m) => m.role !== "system")
        .map((m) => ({ role: m.role as "user" | "assistant", content: m.content }));

      const stream = anthropicClient.messages.stream({
        model: CLAUDE_MODEL,
        max_tokens: maxTokens,
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

      const finalMessage = await stream.finalMessage();
      usage.prompt_tokens = finalMessage.usage.input_tokens;
      usage.completion_tokens = finalMessage.usage.output_tokens;
      usage.total_tokens = finalMessage.usage.input_tokens + finalMessage.usage.output_tokens;
      return;
    }

    const stream = await deepseekClient.chat.completions.create({
      model: DEEPSEEK_MODEL,
      messages,
      temperature,
      max_tokens: maxTokens,
      stream: true,
      stream_options: { include_usage: true },
    });

    for await (const chunk of stream) {
      const delta = chunk.choices[0]?.delta?.content;
      if (delta) yield delta;

      if (chunk.usage) {
        usage.prompt_tokens = chunk.usage.prompt_tokens ?? 0;
        usage.completion_tokens = chunk.usage.completion_tokens ?? 0;
        usage.total_tokens = chunk.usage.total_tokens ?? 0;
      }
    }
  }

  return { stream: generate(), getUsage: () => usage };
}
