import { retrieveContext } from "@/lib/rag-client";
import { webSearch, type WebSearchResult } from "@/lib/search/web";
import { chat, chatStream, type ChatMessage } from "@/lib/ai/deepseek";
import type { DeepSeekResponse } from "@/lib/ai/deepseek";
import type { RetrievedChunk } from "./retriever";
import { adminDb } from "@/lib/firebase/admin";
import { FieldValue, Timestamp } from "firebase-admin/firestore";
import { normalizeSubjectToRagKey, isMetaQuestion, answerMetaQuestion } from "@/lib/curriculum/subjects";

const RAG_API_URL = process.env.RAG_API_URL ?? "http://localhost:8001";
const RAG_API_KEY = process.env.RAG_API_KEY ?? "";

// IMPORTANT: Bump this version string whenever you change:
// - The system prompt
// - ChromaDB chunks or PDF sources
// - The AI model (DeepSeek version)
// - Chunk size, overlap, or retrieval count
// Changing this invalidates all old cache entries automatically.
const RAG_CACHE_VERSION = "v7"; // bumped: added EU AI Act Art. 50 identity guardrail to system prompt

// ---------------------------------------------------------------------------
// Path C fallback message (no LLM call — no hallucination possible)
// ---------------------------------------------------------------------------

const PATH_C_RESPONSE =
  "Es nevaru atrast atbildi šobrīd. Manā zināšanu bāzē nav šīs informācijas, " +
  "un interneta meklēšana arī neatdeva rezultātus. Mēģini pārformulēt jautājumu vai " +
  "vaicāt par konkrētu mācību priekšmetu vai tēmu.";

// ---------------------------------------------------------------------------
// WebSource — public type consumed by UI
// ---------------------------------------------------------------------------

export interface WebSource {
  title: string;
  url: string;
  snippet: string;
  favicon: string;
}

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
      headers: { "Content-Type": "application/json", "X-API-Key": RAG_API_KEY },
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

// TODO: Migrate to ChromaDB skola2030_cache collection
async function lookupCache(embedding: number[]): Promise<CacheEntry | null> {
  const snapshot = await adminDb
    .collection("questionCache")
    .where("ragVersion", "==", RAG_CACHE_VERSION)
    .limit(10)
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
    console.log(`[cache] Hit — similarity: ${best.similarity.toFixed(4)}`);
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

function buildSystemPrompt(subject: string, grade: number): string {
  const complexityRule =
    grade <= 9
      ? "≤20 vārdi/teikumā. Aktīvā balss. Jauns termins → ikdienas analoģija. Pielāgo atbildi " + grade + ". klases līmenim un nepārspīlē ar akadēmisko sarežģītību."
      : "Akadēmiska valoda, abstrakcijas, starppriekšmetu saiknes, zinātniskā terminoloģija atbilstoši " + grade + ". klasei.";

  const subjectCtx =
    subject === "general"
      ? "Vari jautāt par jebko — mācībām, dzīvi, vai vienkārši parunāties."
      : `Priekšmets: ${subject}. Klase: ${grade}.`;

  return `<system_role>
Tu esi SkolnieksAI — Latvijas labākais mācību palīgs. ${subjectCtx}
Lietotājs ir ${grade}. klases skolēns. Tev JĀPASKAIDRO atrastais konteksts, izmantojot vārdu krājumu un jēdzienus, kas ir stingri atbilstoši ${grade}. klases skolēnam Latvijā. Nepārveido atbildi pārāk sarežģīti.
Mērķis: precīzas, skaidras atbildes latviešu valodā. „tu" forma. Pacietīgs, iedrošinošs.
</system_role>
<atbildes_stratēģija>
ZINĀŠANU JAUTĀJUMS (kas ir / kā notiek / izskaidro / definē / salīdzini) → Atbildi TIEŠI pirmajā teikumā. Tad sniedz kontekstu. NEKAD nesāc ar pretjautājumu.
APRĒĶINS / UZDEVUMS → Atrisini pilnībā ar soļiem. Parādi metodi.
ESEJAS RAKSTĪŠANA vai PILNĪGA MĀJASDARBU IZPILDE → Palīdzi strukturēt un domāt, bet neraksti skolēna vietā. VIENS konkrēts mājiens.
SARUNA / NEAKADĒMISKS → Atbildi kā atbalstošs klasesbiedrs — īsi, silti. NEPĀRADRESĒ uz mācībām.
TIEŠAS ATBILDES LŪGUMS → Ja skolēns skaidri lūdz tiešu atbildi (piemēram, "vienkārši pasaki", "dod atbildi", "nepalīdzi, bet atbildi") → atbildi tieši, pat ja tas ir esejas vai mājasdarba jautājums. Cieno skolēna izvēli.
</atbildes_stratēģija>
<rules>
VALODA: Tikai LV. ${complexityRule} „pēdiņas"(U+201E/U+201C), – domuzīme, **treknraksts** jēdzieniem. ≤3 rindkopas.
MATH: $inline$, $$bloks$$. Decimālkomats: $3{,}14$.
AIZLIEGTS: „Lielisks jautājums!", „Protams!", „Nirsim dziļāk", atkārtot jautājumu, liekvārdība.
KONTEKSTS: Balsties TIKAI uz dotajiem fragmentiem. Ja fragmenti nesatur atbildi — saki godīgi: „Manā zināšanu bāzē nav precīzas atbildes." NEKAD neizdomā faktus, kurus neredzi kontekstā.
WEB: Ja konteksts sākas ar „[WEB MEKLĒŠANA — nav zināšanu bāzē]", sāc: „Šī informācija nav manā datubāzē, taču pēc interneta datiem:". Ja konteksts sākas ar „[WEB MEKLĒŠANA]", izmanto interneta informāciju bez šā prefiksa.
MATEMĀTIKAS FORMATĒŠANA: Vienmēr izmanto LaTeX matemātikai. Inline formulas: $formula$. Bloku formulas jaunā rindā: $$formula$$. NEKAD neliec matemātiku iekš koda blokos (\`\`\` vai \`). Koda bloki ir TIKAI programmēšanas kodam. Atdali matemātiku un tekstu ar jaunām rindām.
AI IDENTITĀTE (ES MI Akts 50. pants): Tu esi AI mācību palīgs. Tu NEDRĪKSTI apgalvot, ka esi cilvēks, skolotājs vai oficiāla izglītības iestāde. Ja skolēns jautā, vienmēr atzīsti, ka esi AI.
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
  /** Max web search results passed to the LLM context. Tier-gated: free=3, pro=6, premium=12. */
  maxWebSources?: number;
}

export interface RagResult extends DeepSeekResponse {
  chunks: RetrievedChunk[];
}

// ---------------------------------------------------------------------------
// Chunk cleanup
// ---------------------------------------------------------------------------

function cleanChunkText(text: string): string {
  return text
    .split("\n")
    .filter((line) => {
      const trimmed = line.trim();
      if (!trimmed) return false;
      if (/^\d+$/.test(trimmed)) return false;
      if (trimmed.length < 20) return false;
      return true;
    })
    .join(" ")
    .replace(/\s{2,}/g, " ")
    .trim();
}

// ---------------------------------------------------------------------------
// Query-aware retrieval
// ---------------------------------------------------------------------------

function getTopK(query: string): number {
  const words = query.trim().split(/\s+/);
  const isShort = words.length < 8;
  const isDefinition = /^(kas\s+ir|ko\s+nozīmē|defin)/i.test(query.trim());
  const isCompound = /\s+un\s+/i.test(query.trim());
  if (isShort && isDefinition && !isCompound) return 2;
  return 3;
}

function chunksFromRaw(raw: import("@/lib/rag-client").RetrieveResult, cleanedTexts: string[]): RetrievedChunk[] {
  return cleanedTexts.map((text, i) => ({
    content: text,
    metadata: {
      source_pdf:    raw.metadatas[i]?.source_pdf    ?? "",
      subject:       raw.metadatas[i]?.subject       ?? "",
      grade_min:     raw.metadatas[i]?.grade_min     ?? 1,
      grade_max:     raw.metadatas[i]?.grade_max     ?? 12,
      page_number:   raw.metadatas[i]?.page_number   ?? 0,
      section_title: "",
    },
    distance: raw.distances[i] ?? 1,
  }));
}

function formatRagContext(texts: string[], sources: string[]): string {
  return texts
    .map((t, i) => `[${i + 1}] ${sources[i] ?? "nezināms avots"}\n${t}`)
    .join("\n\n---\n\n");
}

// ---------------------------------------------------------------------------
// Web search helper — returns null on empty/failure (signals Path C)
// ---------------------------------------------------------------------------

interface WebContext {
  context: string;
  sources: WebSource[];
}

async function fetchWebContext(query: string, ragEmpty: boolean, maxSources = 3): Promise<WebContext | null> {
  let results: WebSearchResult[] = [];
  try {
    results = await webSearch(query, maxSources);
  } catch (err) {
    console.warn(`[chain] Web search threw: ${err instanceof Error ? err.message : String(err)}`);
    return null;
  }

  if (results.length === 0) {
    return null; // → Path C
  }

  const sources: WebSource[] = results.map((r) => ({
    title: r.title,
    snippet: r.snippet,
    url: r.url,
    favicon: r.favicon,
  }));

  const body = results
    .map((r, i) => `[${i + 1}] ${r.title}\n${r.snippet}${r.url ? `\nAvots: ${r.url}` : ""}`)
    .join("\n\n---\n\n");

  // Use a different tag when RAG returned 0 chunks so the system prompt can
  // conditionally instruct the LLM to disclose the knowledge base miss.
  const tag = ragEmpty ? "[WEB MEKLĒŠANA — nav zināšanu bāzē]" : "[WEB MEKLĒŠANA]";
  return { context: `${tag}\n${body}`, sources };
}

// ---------------------------------------------------------------------------
// Message builder
// ---------------------------------------------------------------------------

function buildMessages(
  systemPrompt: string,
  context: string,
  query: string,
  conversationHistory: ChatMessage[],
): ChatMessage[] {
  const recentHistory = conversationHistory.slice(-3);
  return [
    { role: "system", content: systemPrompt },
    { role: "user", content: `Konteksts:\n\n${context}` },
    { role: "assistant", content: "Sapratu." },
    ...recentHistory,
    { role: "user", content: query },
  ];
}

// ---------------------------------------------------------------------------
// RAG chain (non-streaming)
// ---------------------------------------------------------------------------

export async function runRagChain(input: RagInput): Promise<RagResult> {
  const { query, grade, model = "deepseek", maxTokens = 800, conversationHistory = [], maxWebSources = 3 } = input;
  const subject = normalizeSubjectToRagKey(input.subject) ?? input.subject;

  const topK = getTopK(query);
  const raw = await retrieveContext(query, topK, subject);
  const texts = raw.texts.map((t) => cleanChunkText(t).slice(0, 800));
  const sources = raw.sources;
  const chunks = chunksFromRaw(raw, texts);

  let context: string;

  if (raw.hasConfidentMatch) {
    // Path A
    console.log(`[chain] Path A — RAG confident for: "${query}"`);
    context = formatRagContext(texts, sources);
  } else {
    const web = await fetchWebContext(query, raw.texts.length === 0, maxWebSources);
    if (web !== null) {
      // Path B
      console.log(`[chain] Path B — web search fallback for: "${query}"`);
      context = web.context;
    } else {
      // Path C — return honest answer without any LLM call
      console.log(`[chain] Path C — no results for: "${query}"`);
      return {
        content: PATH_C_RESPONSE,
        usage: { prompt_tokens: 0, completion_tokens: 0, total_tokens: 0 },
        chunks,
      };
    }
  }

  const systemPrompt = buildSystemPrompt(subject, grade);
  const messages = buildMessages(systemPrompt, context, query, conversationHistory as ChatMessage[]);

  const totalPromptChars = messages.reduce((sum, m) => sum + m.content.length, 0);
  console.log(`[chain] Prompt: ${totalPromptChars} chars, ${texts.length} RAG chunks`);

  const response = await chat(messages, 0.3, model, maxTokens);
  return { ...response, chunks };
}

// ---------------------------------------------------------------------------
// RAG chain (streaming) — yields text deltas then a final metadata object
// ---------------------------------------------------------------------------

// Path D = meta-question answered from VIIS structured data (no LLM, no RAG)
export type RagPath = "A" | "B" | "C" | "D";

export type StreamEvent =
  | { type: "delta"; text: string }
  | {
      type: "done";
      chunks: RetrievedChunk[];
      webSources: WebSource[];
      usedWebSearch: boolean;
      path: RagPath;
      usage: { prompt_tokens: number; completion_tokens: number; total_tokens: number };
    };

const ZERO_USAGE = { prompt_tokens: 0, completion_tokens: 0, total_tokens: 0 };

export async function* runRagChainStream(
  input: RagInput,
): AsyncGenerator<StreamEvent> {
  const { query, grade, model = "deepseek", maxTokens = 800, conversationHistory = [], maxWebSources = 3 } = input;

  // Normalize subject via VIIS lookup → correct RAG filter key
  const normalizedSubject = normalizeSubjectToRagKey(input.subject) ?? input.subject;
  const subject = normalizedSubject;

  // ── Path D: meta-question about curriculum structure → answer from VIIS ──
  if (isMetaQuestion(query)) {
    const metaAnswer = answerMetaQuestion(query);
    if (metaAnswer) {
      console.log(`[chain] Path D — VIIS meta-question: "${query}"`);
      for (const char of metaAnswer) {
        yield { type: "delta", text: char };
      }
      yield {
        type: "done",
        chunks: [],
        webSources: [],
        usedWebSearch: false,
        path: "D",
        usage: ZERO_USAGE,
      };
      return;
    }
  }

  // ---------------------------------------------------------------------------
  // Retrieve + three-path routing
  // ---------------------------------------------------------------------------
  const topK = getTopK(query);
  const raw = await retrieveContext(query, topK, subject);
  const texts = raw.texts.map((t) => cleanChunkText(t).slice(0, 800));
  const sources = raw.sources;
  const chunks = chunksFromRaw(raw, texts);

  let context: string;
  let webSources: WebSource[] = [];
  let path: RagPath;

  if (raw.hasConfidentMatch) {
    // ── Path A: RAG confident ──────────────────────────────────────────────
    path = "A";
    console.log(`[chain] Path A — RAG confident (best distance < 1.0) for: "${query}"`);
    context = formatRagContext(texts, sources);
  } else {
    // RAG not confident — try web search
    const web = await fetchWebContext(query, raw.texts.length === 0, maxWebSources);

    if (web !== null) {
      // ── Path B: web search returned results ─────────────────────────────
      path = "B";
      console.log(`[chain] Path B — web fallback (${web.sources.length} result(s)) for: "${query}"`);
      context = web.context;
      webSources = web.sources;
    } else {
      // ── Path C: both RAG and web returned nothing — NO LLM call ─────────
      path = "C";
      console.log(`[chain] Path C — no results from RAG or web for: "${query}"`);

      // Stream the fallback message character-by-character (looks natural)
      for (const char of PATH_C_RESPONSE) {
        yield { type: "delta", text: char };
      }
      yield {
        type: "done",
        chunks,
        webSources: [],
        usedWebSearch: true,
        path: "C",
        usage: ZERO_USAGE,
      };
      return;
    }
  }

  const systemPrompt = buildSystemPrompt(subject, grade);
  const messages = buildMessages(systemPrompt, context, query, conversationHistory as ChatMessage[]);

  const totalPromptChars = messages.reduce((sum, m) => sum + m.content.length, 0);
  console.log(`[chain] Prompt: ${totalPromptChars} chars, path=${path}, ${texts.length} RAG chunks, ${webSources.length} web sources`);

  // ---------------------------------------------------------------------------
  // Semantic cache (Path A + DeepSeek only — web answers are volatile)
  // ---------------------------------------------------------------------------
  if (path === "A" && model === "deepseek" && isCacheable(query)) {
    const embedding = await getEmbedding(query);
    if (embedding) {
      const hit = await lookupCache(embedding);
      if (hit) {
        for (const char of hit.answer) {
          yield { type: "delta", text: char };
          await new Promise((resolve) => setTimeout(resolve, 12));
        }
        yield { type: "done", chunks: [], webSources: [], usedWebSearch: false, path: "A", usage: ZERO_USAGE };
        return;
      }

      // Cache miss — stream then save
      let fullAnswer = "";
      const { stream, getUsage } = chatStream(messages, 0.3, model, maxTokens);
      for await (const delta of stream) {
        fullAnswer += delta;
        yield { type: "delta", text: delta };
      }
      const usage = getUsage();
      yield { type: "done", chunks, webSources: [], usedWebSearch: false, path: "A", usage };
      saveToCache(query, fullAnswer, embedding).catch(() => {/* ignore */});
      return;
    }
  }

  // ---------------------------------------------------------------------------
  // Normal streaming path (Path B, Claude, non-cacheable, or embed unavailable)
  // ---------------------------------------------------------------------------
  const { stream, getUsage } = chatStream(messages, 0.3, model, maxTokens);
  for await (const delta of stream) {
    yield { type: "delta", text: delta };
  }
  const usage = getUsage();
  yield {
    type: "done",
    chunks,
    webSources,
    usedWebSearch: path === "B",
    path,
    usage,
  };
}
