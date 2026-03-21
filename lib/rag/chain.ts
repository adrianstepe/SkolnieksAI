import { retrieveContext } from "@/lib/rag-client";
import { chat, chatStream, type ChatMessage } from "@/lib/ai/deepseek";
import type { DeepSeekResponse } from "@/lib/ai/deepseek";
import type { RetrievedChunk } from "./retriever";

// ---------------------------------------------------------------------------
// System prompt — Latvian, Skola2030-aligned
// ---------------------------------------------------------------------------

function buildSystemPrompt(subject: string, grade: number): string {
  return `Tu esi SkolnieksAI — draudzīgs Latvijas skolēnu mācību palīgs.
Skolēna klase: ${grade}. klase. Mācību priekšmets: ${subject}.

Noteikumi:
- Atbildi TIKAI latviešu valodā.
- Izmanto TIKAI sniegto kontekstu [1]–[5]. Neizmanto zināšanas ārpus tā.
- Ja atbilde nav kontekstā — atbildi: "Šī informācija nav manā datubāzē."
- Nekad nesniedz gatavu mājas darba atbildi. Palīdzi saprast procesu.
- Nevaicā pretjautājumus atbildes beigās.

Formatējums:
- Izmanto Markdown: **treknraksts** svarīgiem jēdzieniem.
- Soļus un uzskaitījumus formatē kā sarakstu (-, 1. 2. 3.).
- Maksimums 3 rindkopas. Esi kodolīgs — nekad neraksti vairāk nekā nepieciešams.`;
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
  chunks: RetrievedChunk[];
}

// ---------------------------------------------------------------------------
// RAG chain (non-streaming)
// ---------------------------------------------------------------------------

function chunksFromTexts(texts: string[]): RetrievedChunk[] {
  return texts.map((text) => ({
    content: text,
    metadata: { source_pdf: "", subject: "", grade_min: 1, grade_max: 12, page_number: 0, chunk_index: 0 },
    distance: 0,
  }));
}

function formatContext(texts: string[], sources: string[]): string {
  return texts
    .map((t, i) => `[${i + 1}] ${sources[i] ?? "nezināms avots"}\n${t}`)
    .join("\n\n---\n\n");
}

function buildMessages(
  systemPrompt: string,
  context: string,
  query: string,
  conversationHistory: ChatMessage[],
): ChatMessage[] {
  return [
    { role: "system", content: systemPrompt },
    { role: "user", content: `Šeit ir atbilstošas Skola2030 mācību programmas sadaļas:\n\n${context}` },
    { role: "assistant", content: "Sapratu. Atbildēšu balstoties uz šo informāciju." },
    ...conversationHistory,
    { role: "user", content: query },
  ];
}

export async function runRagChain(input: RagInput): Promise<RagResult> {
  const { query, subject, grade, conversationHistory = [] } = input;

  const { texts, sources } = await retrieveContext(query);
  const chunks = chunksFromTexts(texts);
  const context = formatContext(texts, sources);
  const messages = buildMessages(buildSystemPrompt(subject, grade), context, query, conversationHistory as ChatMessage[]);

  const response = await chat(messages);
  return { ...response, chunks };
}

// ---------------------------------------------------------------------------
// RAG chain (streaming) — yields text deltas then a final metadata object
// ---------------------------------------------------------------------------

export type StreamEvent =
  | { type: "delta"; text: string }
  | { type: "done"; chunks: RetrievedChunk[]; usage: { prompt_tokens: number; completion_tokens: number; total_tokens: number } };

export async function* runRagChainStream(
  input: RagInput,
): AsyncGenerator<StreamEvent> {
  const { query, subject, grade, conversationHistory = [] } = input;

  const { texts, sources } = await retrieveContext(query);
  console.log("[RAG] retrieveContext result:", {
    chunkCount: texts.length,
    sources,
    firstChunkPreview: texts[0]?.slice(0, 200) ?? "(empty)",
  });

  const chunks = chunksFromTexts(texts);
  const context = formatContext(texts, sources);
  console.log("[RAG] formatted context length:", context.length, "chars");

  const messages = buildMessages(buildSystemPrompt(subject, grade), context, query, conversationHistory as ChatMessage[]);
  console.log("[RAG] messages sent to AI:", JSON.stringify(messages, null, 2));

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
