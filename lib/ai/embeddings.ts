/**
 * lib/ai/embeddings.ts — Jina v3 embeddings via hosted API.
 *
 * Model: jina-embeddings-v3 (1024 dims).
 * Uses asymmetric task types for retrieval quality:
 *   - "retrieval.query"   → when embedding user queries
 *   - "retrieval.passage" → when embedding documents for indexing
 */

type JinaTask = "retrieval.query" | "retrieval.passage";

const JINA_API_URL = "https://api.jina.ai/v1/embeddings";
const JINA_MODEL = "jina-embeddings-v3";
const TIMEOUT_MS = 10_000;
const MAX_BATCH_SIZE = 100;

interface JinaEmbeddingResponse {
  data: { embedding: number[] }[];
}

function getApiKey(): string {
  const key = process.env.JINA_API_KEY;
  if (!key) {
    throw new Error("JINA_API_KEY environment variable is not set");
  }
  return key;
}

async function callJinaApi(
  input: string[],
  task: JinaTask,
): Promise<number[][]> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS);

  try {
    const res = await fetch(JINA_API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${getApiKey()}`,
      },
      body: JSON.stringify({ model: JINA_MODEL, task, input }),
      signal: controller.signal,
    });

    if (!res.ok) {
      const body = await res.text().catch(() => "(unreadable)");
      throw new Error(
        `Jina API error ${res.status}: ${body}`,
      );
    }

    const json = (await res.json()) as JinaEmbeddingResponse;
    return json.data.map((d) => d.embedding);
  } finally {
    clearTimeout(timeout);
  }
}

/**
 * Embed a single string via Jina v3. Returns a 1024-dim vector.
 *
 * @param task - "retrieval.query" for search queries, "retrieval.passage" for documents
 */
export async function embedText(
  text: string,
  task: JinaTask,
): Promise<number[]> {
  const [embedding] = await callJinaApi([text], task);
  return embedding;
}

/**
 * Embed a batch of strings via Jina v3. Automatically splits into
 * sub-batches of 100 (Jina's per-request limit).
 *
 * @param task - "retrieval.query" for search queries, "retrieval.passage" for documents
 */
export async function embedTexts(
  texts: string[],
  task: JinaTask,
): Promise<number[][]> {
  const results: number[][] = [];

  for (let i = 0; i < texts.length; i += MAX_BATCH_SIZE) {
    const batch = texts.slice(i, i + MAX_BATCH_SIZE);
    const embeddings = await callJinaApi(batch, task);
    results.push(...embeddings);
  }

  return results;
}
