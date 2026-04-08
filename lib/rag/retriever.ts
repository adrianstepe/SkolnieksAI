/**
 * lib/rag/retriever.ts — Pure TypeScript retriever using Chroma Cloud.
 *
 * Replaces the old Python RAG server (localhost:8001) for production use.
 * Embeds queries via @xenova/transformers (Node.js, no Python needed)
 * and queries Chroma Cloud directly using the chromadb npm package.
 */

import { CloudClient, DefaultEmbeddingFunction } from "chromadb";
import type { Collection } from "chromadb";
import { embedText } from "@/lib/ai/embeddings";

const COLLECTION_NAME = "skolnieks_content";

// ---------------------------------------------------------------------------
// Shared constants (canonical source — re-exported by lib/rag-client.ts)
// ---------------------------------------------------------------------------

/**
 * ChromaDB cosine distance: 0 = identical, 2 = opposite.
 * Path A threshold: distance < 1.15 = confidently relevant.
 * paraphrase-multilingual-MiniLM-L12-v2 Latvian cross-lingual distances for
 * genuinely relevant chunks land in the 0.85–0.95 range, but cross-lingual
 * phrasing variance regularly pushes valid hits to 1.00–1.10. Threshold of
 * 1.0 left zero headroom and dropped relevant chunks; 1.15 keeps obvious
 * mismatches out (those land 1.3+) while admitting borderline-good matches.
 */
export const RAG_DISTANCE_THRESHOLD = 1.15;
/**
 * Soft threshold: chunks with distance < this are still usable as
 * last-resort context when web search also fails (instead of refusing).
 */
export const RAG_SOFT_DISTANCE_THRESHOLD = 1.4;

/**
 * Subject values actually stored in ChromaDB (from RAG.py + scripts/ingest.ts).
 * "general" and "unknown" are intentionally excluded — they must NOT trigger a
 * where filter so the query searches across all curriculum chunks.
 */
export const KNOWN_CURRICULUM_SUBJECTS = new Set([
  "latvian_literature", "minority_russian", "history", "social_history",
  "social_sciences", "social_studies", "design_tech", "sports", "arts",
  "culture", "latvian", "russian", "english", "french", "german",
  "literature", "math", "biology", "geography", "science", "physics",
  "chemistry", "programming", "cs", "engineering", "visual_arts", "theater", "music",
  "informatics", "astronomy",
]);

// ---------------------------------------------------------------------------
// Shared types (canonical source — re-exported by lib/rag-client.ts)
// ---------------------------------------------------------------------------

interface ChunkMeta {
  source_pdf: string;
  subject: string;
  grade_min: number;
  grade_max: number;
  page_number: number;
  chunk_index: number;
}

export interface RetrieveResult {
  texts: string[];
  sources: string[];
  /** ChromaDB cosine distances per chunk (0–2). Empty if no results. */
  distances: number[];
  /** Full metadata per chunk. */
  metadatas: ChunkMeta[];
  /**
   * True when at least one retrieved chunk is confidently relevant.
   * False when: no chunks returned, OR all distances exceed RAG_DISTANCE_THRESHOLD.
   */
  hasConfidentMatch: boolean;
}

// ---------------------------------------------------------------------------
// Chroma Cloud client (singleton)
// ---------------------------------------------------------------------------

let clientInstance: CloudClient | null = null;
let collectionInstance: Collection | null = null;

function getCloudClient(): CloudClient {
  if (!clientInstance) {
    const apiKey = process.env.CHROMA_API_KEY;
    const tenant = process.env.CHROMA_TENANT;
    const database = process.env.CHROMA_DATABASE ?? "skolnieksai";

    if (!apiKey || !tenant) {
      throw new Error(
        "CHROMA_API_KEY and CHROMA_TENANT must be set for Chroma Cloud",
      );
    }

    clientInstance = new CloudClient({
      apiKey,
      tenant,
      database,
    });
  }
  return clientInstance;
}

async function getCollection(): Promise<Collection> {
  if (!collectionInstance) {
    const client = getCloudClient();
    // embeddingFunction is required by the SDK type but never invoked
    // because we always pass raw queryEmbeddings in .query() calls.
    collectionInstance = await client.getCollection({
      name: COLLECTION_NAME,
      embeddingFunction: new DefaultEmbeddingFunction(),
    });
  }
  return collectionInstance;
}

// ---------------------------------------------------------------------------
// Types for chain.ts
// ---------------------------------------------------------------------------

export interface RetrievalFilter {
  subject?: string;
  grade?: number;
}

export interface RetrievedChunk {
  content: string;
  metadata: {
    source_pdf: string;
    subject: string;
    grade_min: number;
    grade_max: number;
    page_number: number;
    section_title: string;
  };
  distance: number;
}

// ---------------------------------------------------------------------------
// Core retrieval — returns RetrieveResult (same shape as lib/rag-client.ts)
// ---------------------------------------------------------------------------

/**
 * Embed a query and retrieve matching chunks from Chroma Cloud.
 * Returns the same RetrieveResult shape used by lib/rag-client.ts so
 * lib/rag/chain.ts requires zero changes.
 *
 * Falls back gracefully (empty result) on any error — never throws.
 */
export async function retrieveFromCloud(
  question: string,
  topK = 3,
  subject?: string,
): Promise<RetrieveResult> {
  const empty: RetrieveResult = {
    texts: [],
    sources: [],
    distances: [],
    metadatas: [],
    hasConfidentMatch: false,
  };

  try {
    // 1. Embed the query
    const queryEmbedding = await embedText(question);

    // 2. Build where clause
    const whereSubject =
      subject !== undefined && KNOWN_CURRICULUM_SUBJECTS.has(subject)
        ? subject
        : undefined;

    const where: Record<string, unknown> | undefined = whereSubject
      ? { subject: { $eq: whereSubject } }
      : undefined;

    // 3. Query Chroma Cloud with 8s timeout to avoid hanging Vercel functions
    const collection = await getCollection();
    const results = await Promise.race([
      collection.query({
        queryEmbeddings: [queryEmbedding],
        nResults: topK,
        where,
        include: ["documents", "metadatas", "distances"] as never,
      }),
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error("Chroma query timed out (8s)")), 8_000),
      ),
    ]);

    const docs = results.documents?.[0] ?? [];
    const metas = results.metadatas?.[0] ?? [];
    const distances = results.distances?.[0] ?? [];

    if (docs.length === 0) {
      console.warn(
        "[retriever] Chroma Cloud returned 0 chunks — collection may be empty or query had no matches",
      );
      return empty;
    }

    // 4. Build RetrieveResult
    const texts: string[] = [];
    const sources: string[] = [];
    const distArr: number[] = [];
    const metadatas: RetrieveResult["metadatas"] = [];

    for (let i = 0; i < docs.length; i++) {
      const doc = docs[i];
      if (!doc) continue;

      const meta = (metas[i] ?? {}) as Record<string, unknown>;
      const dist = distances[i] ?? 2;

      const pdf = String(meta.source_pdf ?? "unknown");
      const subj = String(meta.subject ?? "");
      const srcType = String(meta.source_type ?? "");

      let label = `${pdf} | ${subj}`;
      if (srcType) label = `[${srcType}] ${label}`;

      texts.push(doc);
      sources.push(label);
      distArr.push(dist);
      metadatas.push({
        source_pdf: pdf,
        subject: subj,
        grade_min: Number(meta.grade_min ?? 1),
        grade_max: Number(meta.grade_max ?? 12),
        page_number: Number(meta.page_number ?? 0),
        chunk_index: Number(meta.chunk_index ?? 0),
      });
    }

    const hasConfidentMatch =
      texts.length > 0 &&
      distArr.some((d) => d < RAG_DISTANCE_THRESHOLD);

    // Debug logging
    const scoreInfo = distArr
      .map((d, i) => `chunk[${i}] dist=${d.toFixed(3)}`)
      .join(", ");
    console.log(
      `[retriever] Retrieved: ${scoreInfo} | confident=${hasConfidentMatch}`,
    );
    console.log(`[retriever] Sources: ${sources.join(", ")}`);

    return { texts, sources, distances: distArr, metadatas, hasConfidentMatch };
  } catch (err) {
    if (err instanceof Error) {
      console.error(`[retriever] Chroma Cloud error: ${err.message}`);
    }
    // Reset collection instance on error so next call retries connection
    collectionInstance = null;
    return empty;
  }
}

// ---------------------------------------------------------------------------
// Legacy helper
// ---------------------------------------------------------------------------

export function formatContext(chunks: RetrievedChunk[]): string {
  return chunks
    .map((chunk, i) => {
      const { source_pdf, subject, grade_min, grade_max } = chunk.metadata;
      const header = `[${i + 1}] ${source_pdf} | ${subject} | grades ${grade_min}–${grade_max}`;
      return `${header}\n${chunk.content}`;
    })
    .join("\n\n---\n\n");
}
