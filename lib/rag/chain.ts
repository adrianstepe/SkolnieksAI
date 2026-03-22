import { retrieveContext } from "@/lib/rag-client";
import { chat, chatStream, type ChatMessage } from "@/lib/ai/deepseek";
import type { DeepSeekResponse } from "@/lib/ai/deepseek";
import type { RetrievedChunk } from "./retriever";
import { adminDb } from "@/lib/firebase/admin";
import { FieldValue, Timestamp } from "firebase-admin/firestore";

const RAG_API_URL = process.env.RAG_API_URL ?? "http://localhost:8001";

// IMPORTANT: Bump this version string whenever you change:
// - The system prompt
// - ChromaDB chunks or PDF sources
// - The AI model (DeepSeek version)
// - Chunk size, overlap, or retrieval count
// Changing this invalidates all old cache entries automatically.
const RAG_CACHE_VERSION = "v1";

// ---------------------------------------------------------------------------
// Semantic cache helpers
// ---------------------------------------------------------------------------

function cosineSimilarity(a: number[], b: number[]): number {
  const dot = a.reduce((sum, ai, i) => sum + ai * b[i], 0);
  const magA = Math.sqrt(a.reduce((sum, ai) => sum + ai * ai, 0));
  const magB = Math.sqrt(b.reduce((sum, bi) => sum + bi * bi, 0));
  return dot / (magA * magB);
}

/** Returns true if the query should be eligible for cache lookup/save. */
function isCacheable(query: string): boolean {
  if (query.length < 8) return false;
  // Personal context — cached answer would be wrong for other users
  if (/\b(man|es|mana|manu|manam|manā)\b/i.test(query)) return false;
  // Follow-up references — depend on prior conversation context
  if (/^(un vēl|paskaidro vairāk|vairāk|turpini|kāpēc tā|piemēram)/i.test(query.trim())) return false;
  return true;
}

async function getEmbedding(text: string): Promise<number[] | null> {
  try {
    const res = await fetch(`${RAG_API_URL}/embed`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text }),
      signal: AbortSignal.timeout(5_000),
    });
    if (!res.ok) return null;
    const data = (await res.json()) as { embedding: number[] };
    return data.embedding;
  } catch {
    return null;
  }
}

interface CacheEntry {
  id: string;
  answer: string;
  embedding: number[];
  hitCount: number;
}

async function lookupCache(embedding: number[]): Promise<CacheEntry | null> {
  const snapshot = await adminDb
    .collection("questionCache")
    .where("ragVersion", "==", RAG_CACHE_VERSION)
    .limit(50)
    .get();

  let best: { entry: CacheEntry; similarity: number } | null = null;

  for (const doc of snapshot.docs) {
    const data = doc.data() as Record<string, unknown>;
    const cachedEmbedding = data.embedding as number[] | undefined;
    if (!cachedEmbedding) continue;
    const sim = cosineSimilarity(embedding, cachedEmbedding);
    if (sim >= 0.93 && (!best || sim > best.similarity)) {
      best = {
        entry: {
          id: doc.id,
          answer: data.answer as string,
          embedding: cachedEmbedding,
          hitCount: (data.hitCount as number) ?? 0,
        },
        similarity: sim,
      };
    }
  }

  if (best) {
    console.log(`[DEBUG] Cache hit — similarity: ${best.similarity.toFixed(4)}`);
    // Fire-and-forget: increment hit stats
    adminDb.collection("questionCache").doc(best.entry.id).update({
      hitCount: FieldValue.increment(1),
      lastHitAt: Timestamp.now(),
    }).catch(() => {/* ignore */});
    return best.entry;
  }
  return null;
}

async function saveToCache(question: string, answer: string, embedding: number[]): Promise<void> {
  const cacheRef = adminDb.collection("questionCache");

  // Size protection: keep cache under 5,000 entries per RAG version
  const countSnap = await cacheRef
    .where("ragVersion", "==", RAG_CACHE_VERSION)
    .count()
    .get();
  const total = countSnap.data().count;

  if (total >= 5000) {
    // Delete 500 entries (no orderBy — avoids composite index requirement)
    const oldest = await cacheRef
      .where("ragVersion", "==", RAG_CACHE_VERSION)
      .limit(500)
      .get();
    const batch = adminDb.batch();
    for (const doc of oldest.docs) batch.delete(doc.ref);
    await batch.commit();
  }

  await cacheRef.add({
    question,
    answer,
    embedding,
    ragVersion: RAG_CACHE_VERSION,
    createdAt: Timestamp.now(),
    hitCount: 0,
    lastHitAt: null,
  });
}

// ---------------------------------------------------------------------------
// System prompt — Latvian, Skola2030-aligned
// ---------------------------------------------------------------------------

/**
 * Builds the system prompt for SkolnieksAI.
 * Optimised for token economy (~150 tokens).
 */
function buildSystemPrompt(subject: string, grade: number): string {
  const complexityRule =
    grade <= 9
      ? "≤20 vārdi/teikumā. Aktīvā balss. Jauns termins → ikdienas analoģija. Bez ligzdotiem palīgteikumiem."
      : "Akadēmiska valoda, abstrakcijas, starppriekšmetu saiknes, zinātniskā terminoloģija.";

  return `<system_role>
Tu esi SkolnieksAI — Latvijas mācību palīgs (6.–12.kl.), Skola2030. Klase: ${grade}, priekšmets: ${subject}.
Sokrātisks ceļvedis: pacietīgs, iedrošinošs, „tu" forma.
Fakti/definīcijas → atbildi tieši. Uzdevumi → Sokrātiskā metode, VIENS mājiens. „Pastāsti" → izpildi.
</system_role>
<rules>
VALODA: Tikai LV. Pro-drop, debitīvs. ${complexityRule}
STILS: „pēdiņas"(U+201E/U+201C), – domuzīme, **treknraksts** jēdzieniem. ≤3 rindkopas. Bez: „Lielisks jautājums!", „Protams!", „Nirsim dziļāk". Neatkārto jautājumu, bez liekvārdības.
MATH: $inline$, $$bloks$$. Decimālkomats: $3{,}14$.
KONTEKSTS: Secini no fragmentiem. Nekad „nav datubāzē"/„nevaru". Nepietiek → saistīta tēma.
<thinking> pirms atbildes (slēpts).
</rules>`;
}

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface RagInput {
  query: string;
  subject: string;
  grade: number;
  model?: "deepseek" | "claude";
  maxTokens?: number;
  conversationHistory?: ChatMessage[];
}

export interface RagResult extends DeepSeekResponse {
  chunks: RetrievedChunk[];
}

// ---------------------------------------------------------------------------
// RAG chain (non-streaming)
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// Chunk cleanup — strip boilerplate, headers, page numbers before injection
// ---------------------------------------------------------------------------

function cleanChunkText(text: string): string {
  return text
    .split("\n")
    .filter((line) => {
      const trimmed = line.trim();
      if (!trimmed) return false;
      // Purely numeric lines (page numbers, table indices)
      if (/^\d+$/.test(trimmed)) return false;
      // Very short lines — likely headers, section labels, or artifacts
      if (trimmed.length < 20) return false;
      return true;
    })
    .join(" ")
    .replace(/\s{2,}/g, " ")
    .trim();
}

// ---------------------------------------------------------------------------
// Query-aware retrieval — simple definition queries need fewer chunks
// ---------------------------------------------------------------------------

function getTopK(query: string): number {
  const words = query.trim().split(/\s+/);
  const isShort = words.length < 8;
  const isDefinition = /^(kas\s+ir|ko\s+nozīmē|defin)/i.test(query.trim());
  const isCompound = /\s+un\s+/i.test(query.trim());
  if (isShort && isDefinition && !isCompound) return 2;
  return 3;
}

function chunksFromTexts(texts: string[]): RetrievedChunk[] {
  return texts.map((text) => ({
    content: text,
    metadata: { source_pdf: "", subject: "", grade_min: 1, grade_max: 12, page_number: 0, chunk_index: 0, section_title: "" },
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
  // Limit history to last 3 messages to control input token growth
  const recentHistory = conversationHistory.slice(-3);

  // Anchor-turn pattern: context in a dedicated user turn acknowledged by
  // the assistant, so the model treats the chunks as "received" information.
  return [
    { role: "system", content: systemPrompt },
    { role: "user", content: `Konteksts no Skola2030:\n\n${context}` },
    { role: "assistant", content: "Sapratu." },
    ...recentHistory,
    { role: "user", content: query },
  ];
}

export async function runRagChain(input: RagInput): Promise<RagResult> {
  const { query, subject, grade, model = "deepseek", maxTokens = 800, conversationHistory = [] } = input;

  const topK = getTopK(query);
  const raw = await retrieveContext(query, topK);
  const texts = raw.texts.map((t) => cleanChunkText(t).slice(0, 800));
  const sources = raw.sources;
  const chunks = chunksFromTexts(texts);
  const context = formatContext(texts, sources);
  const systemPrompt = buildSystemPrompt(subject, grade);
  const messages = buildMessages(systemPrompt, context, query, conversationHistory as ChatMessage[]);

  const totalPromptChars = messages.reduce((sum, m) => sum + m.content.length, 0);
  console.log(`[DEBUG] Total prompt length: ${totalPromptChars} characters (${messages.length} messages, ${texts.length} chunks)`);

  const response = await chat(messages, 0.3, model, maxTokens);
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
  const { query, subject, grade, model = "deepseek", maxTokens = 800, conversationHistory = [] } = input;

  // --- Semantic cache lookup (DeepSeek only — Claude responses are personalised) ---
  if (model === "deepseek" && isCacheable(query)) {
    const embedding = await getEmbedding(query);
    if (embedding) {
      const hit = await lookupCache(embedding);
      if (hit) {
        // Stream cached answer character by character at 12ms/char
        for (const char of hit.answer) {
          yield { type: "delta", text: char };
          await new Promise((resolve) => setTimeout(resolve, 12));
        }
        yield {
          type: "done",
          chunks: [],
          usage: { prompt_tokens: 0, completion_tokens: 0, total_tokens: 0 },
        };
        return;
      }

      // Cache miss — run RAG normally, then save result in background
      const topK = getTopK(query);
      const raw = await retrieveContext(query, topK);
      const texts = raw.texts.map((t) => cleanChunkText(t).slice(0, 800));
      const sources = raw.sources;
      const chunks = chunksFromTexts(texts);
      const context = formatContext(texts, sources);
      const systemPrompt = buildSystemPrompt(subject, grade);
      const messages = buildMessages(systemPrompt, context, query, conversationHistory as ChatMessage[]);

      const totalPromptChars = messages.reduce((sum, m) => sum + m.content.length, 0);
      console.log(`[DEBUG] Total prompt length: ${totalPromptChars} characters (${messages.length} messages, ${texts.length} chunks)`);

      let fullAnswer = "";
      const { stream, getUsage } = chatStream(messages, 0.3, model, maxTokens);
      for await (const delta of stream) {
        fullAnswer += delta;
        yield { type: "delta", text: delta };
      }

      const usage = getUsage();
      yield { type: "done", chunks, usage };

      // Fire-and-forget cache save
      saveToCache(query, fullAnswer, embedding).catch(() => {/* ignore */});
      return;
    }
  }

  // --- Normal RAG path (cache skipped: Claude model, non-cacheable query, or embed unavailable) ---
  const topK = getTopK(query);
  const raw = await retrieveContext(query, topK);
  // Clean boilerplate then truncate to 800 chars
  const texts = raw.texts.map((t) => cleanChunkText(t).slice(0, 800));
  const sources = raw.sources;

  const chunks = chunksFromTexts(texts);
  const context = formatContext(texts, sources);
  const systemPrompt = buildSystemPrompt(subject, grade);
  const messages = buildMessages(systemPrompt, context, query, conversationHistory as ChatMessage[]);

  // Permanent debug logging — monitor prompt size
  const totalPromptChars = messages.reduce((sum, m) => sum + m.content.length, 0);
  console.log(`[DEBUG] Total prompt length: ${totalPromptChars} characters (${messages.length} messages, ${texts.length} chunks)`);

  const { stream, getUsage } = chatStream(messages, 0.3, model, maxTokens);
  for await (const delta of stream) {
    yield { type: "delta", text: delta };
  }

  const usage = getUsage();
  yield {
    type: "done",
    chunks,
    usage,
  };
}
