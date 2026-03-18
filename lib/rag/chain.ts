import { retrieve, formatContext, type RetrievalFilter } from "./retriever";
import { chat, chatStream, type ChatMessage } from "@/lib/ai/deepseek";
import type { DeepSeekResponse } from "@/lib/ai/deepseek";

// ---------------------------------------------------------------------------
// System prompt — Latvian, Skola2030-aligned
// ---------------------------------------------------------------------------

function buildSystemPrompt(subject: string, grade: number): string {
  return `Tu esi SkolnieksAI — Latvijas skolēnu mācību palīgs, kas strādā ar Skola2030 mācību programmu.

Tavs uzdevums: palīdzēt skolēnam SAPRAST mācību vielu — nevis darīt mājas darbus viņa vietā.

Konteksts:
- Skolēna klase: ${grade}. klase
- Mācību priekšmets: ${subject}
- Programma: Latvijas Skola2030 standarts

Noteikumi:
1. Atbildi VIENMĒR latviešu valodā.
2. Atsaucies uz Skola2030 mācību programmu, ja kontekstā ir attiecīga informācija.
3. Skaidro soli pa solim — pielāgoti ${grade}. klases līmenim.
4. Ja nepieciešams, uzdod pretjautājumus, lai saprastu, kas konkrēti ir nesaprotams.
5. Nekad nesniedz gatavu mājas darba atbildi — palīdzi saprast procesu.
6. Ja kontekstā nav pietiekamas informācijas, saki to godīgi.`;
}

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface RagInput {
  query: string;
  subject: string;
  grade: number;
  conversationHistory?: ChatMessage[];
}

export interface RagResult extends DeepSeekResponse {
  chunks: Awaited<ReturnType<typeof retrieve>>;
}

// ---------------------------------------------------------------------------
// RAG chain (non-streaming)
// ---------------------------------------------------------------------------

export async function runRagChain(input: RagInput): Promise<RagResult> {
  const { query, subject, grade, conversationHistory = [] } = input;

  const filters: RetrievalFilter = { subject, grade };
  const chunks = await retrieve(query, filters, 5);
  const context = formatContext(chunks);

  const systemPrompt = buildSystemPrompt(subject, grade);

  const contextMessage: ChatMessage = {
    role: "user",
    content:
      `Šeit ir atbilstošas Skola2030 mācību programmas sadaļas:\n\n${context}\n\n---\n\n` +
      `Skolēna jautājums: ${query}`,
  };

  const messages: ChatMessage[] = [
    { role: "system", content: systemPrompt },
    ...conversationHistory,
    contextMessage,
  ];

  const response = await chat(messages);
  return { ...response, chunks };
}

// ---------------------------------------------------------------------------
// RAG chain (streaming) — yields text deltas then a final metadata object
// ---------------------------------------------------------------------------

export type StreamEvent =
  | { type: "delta"; text: string }
  | { type: "done"; chunks: Awaited<ReturnType<typeof retrieve>>; usage: { prompt_tokens: number; completion_tokens: number; total_tokens: number } };

export async function* runRagChainStream(
  input: RagInput,
): AsyncGenerator<StreamEvent> {
  const { query, subject, grade, conversationHistory = [] } = input;

  const filters: RetrievalFilter = { subject, grade };
  const chunks = await retrieve(query, filters, 5);
  const context = formatContext(chunks);

  const systemPrompt = buildSystemPrompt(subject, grade);

  const contextMessage: ChatMessage = {
    role: "user",
    content:
      `Šeit ir atbilstošas Skola2030 mācību programmas sadaļas:\n\n${context}\n\n---\n\n` +
      `Skolēna jautājums: ${query}`,
  };

  const messages: ChatMessage[] = [
    { role: "system", content: systemPrompt },
    ...conversationHistory,
    contextMessage,
  ];

  let completionTokens = 0;
  for await (const delta of chatStream(messages)) {
    completionTokens += Math.ceil(delta.length / 4); // rough estimate
    yield { type: "delta", text: delta };
  }

  yield {
    type: "done",
    chunks,
    usage: {
      prompt_tokens: 0, // populated by /api/chat from actual DeepSeek response
      completion_tokens: completionTokens,
      total_tokens: completionTokens,
    },
  };
}
