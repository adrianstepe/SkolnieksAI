import { ChromaClient, Collection } from "chromadb";
import { embedText } from "@/lib/ai/embeddings";
import type { ChunkMetadata } from "@/scripts/ingest";

const CHROMA_URL = process.env.CHROMA_URL ?? "http://localhost:8000";
const COLLECTION_NAME = process.env.CHROMA_COLLECTION ?? "skola2030_chunks";

// Reuse client across requests in the same Node.js process
let clientInstance: ChromaClient | null = null;
let collectionInstance: Collection | null = null;

async function getCollection(): Promise<Collection> {
  if (!collectionInstance) {
    if (!clientInstance) {
      clientInstance = new ChromaClient({ path: CHROMA_URL });
    }
    // We supply raw embeddings, so no embedding function needed.
    // Cast to bypass the required embeddingFunction type constraint.
    collectionInstance = await (clientInstance as unknown as {
      getCollection: (params: { name: string }) => Promise<Collection>;
    }).getCollection({ name: COLLECTION_NAME });
  }
  return collectionInstance;
}

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface RetrievalFilter {
  subject?: string;
  grade?: number;
}

export interface RetrievedChunk {
  content: string;
  metadata: ChunkMetadata;
  distance: number;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Embed the query and fetch the top-k most relevant curriculum chunks.
 * Optionally filter by subject and/or grade level.
 */
export async function retrieve(
  query: string,
  filters?: RetrievalFilter,
  nResults = 3,
): Promise<RetrievedChunk[]> {
  const collection = await getCollection();
  const queryEmbedding = await embedText(query);

  // Build ChromaDB where clause
  const where: Record<string, unknown> = {};
  if (filters?.subject) {
    where.subject = { $eq: filters.subject };
  }
  if (filters?.grade !== undefined) {
    where.$and = [
      { grade_min: { $lte: filters.grade } },
      { grade_max: { $gte: filters.grade } },
    ];
  }

  const results = await collection.query({
    queryEmbeddings: [queryEmbedding],
    nResults,
    where: Object.keys(where).length > 0 ? where : undefined,
    include: ["documents", "metadatas", "distances"] as never,
  });

  const docs = results.documents?.[0] ?? [];
  const metas = results.metadatas?.[0] ?? [];
  const distances = results.distances?.[0] ?? [];

  return docs.map((doc, i) => ({
    content: doc ?? "",
    metadata: (metas[i] ?? {}) as unknown as ChunkMetadata,
    distance: distances[i] ?? 1,
  }));
}

/**
 * Format retrieved chunks into a context block for prompt injection.
 * Each chunk is numbered and tagged with its source.
 */
export function formatContext(chunks: RetrievedChunk[]): string {
  return chunks
    .map((chunk, i) => {
      const { source_pdf, subject, grade_min, grade_max, page_number } =
        chunk.metadata;
      const header = `[${i + 1}] ${source_pdf} | ${subject} | grades ${grade_min}–${grade_max} | p.${page_number}`;
      return `${header}\n${chunk.content}`;
    })
    .join("\n\n---\n\n");
}
