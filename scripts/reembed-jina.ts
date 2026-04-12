/**
 * scripts/reembed-jina.ts — Migrate skolnieks_content → skolnieks_content_v2
 *
 * Reads all chunks from the old 384-dim MiniLM collection, re-embeds them
 * with Jina v3 (1024-dim), and writes to a new collection.
 *
 * Preserves all ids, documents, and metadata exactly as-is.
 *
 * Handles Jina free-tier rate limits (100k tokens/min) with small batches,
 * inter-batch delays, and exponential backoff on 429s.
 *
 * Required env vars:
 *   JINA_API_KEY, CHROMA_API_KEY, CHROMA_TENANT, CHROMA_DATABASE (optional, defaults to "skolnieksai")
 *
 * Usage:
 *   npx tsx --env-file=.env.local scripts/reembed-jina.ts
 */

import { CloudClient, DefaultEmbeddingFunction } from "chromadb";
import { embedTexts } from "../lib/ai/embeddings";

const OLD_COLLECTION = "skolnieks_content";
const NEW_COLLECTION = "skolnieks_content_v2";
const CHROMA_PAGE_SIZE = 300;  // Chroma Cloud quota caps get() at 300 per request
const EMBED_BATCH_SIZE = 20;   // Small batches to stay under 100k tokens/min
const INTER_BATCH_DELAY_MS = 4_000; // 4s between batches ≈ 15 batches/min
const MAX_RETRIES = 5;

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

/**
 * Embed with retry + exponential backoff on 429.
 */
async function embedWithRetry(
  texts: string[],
  retries = MAX_RETRIES,
): Promise<number[][]> {
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      return await embedTexts(texts, "retrieval.passage");
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      const is429 = msg.includes("429");

      if (!is429 || attempt === retries) throw err;

      // Backoff: 15s, 30s, 60s, 120s — give the rate window time to reset
      const backoffMs = Math.min(15_000 * 2 ** (attempt - 1), 120_000);
      console.warn(
        `  ⏳ Rate limited — retry ${attempt}/${retries} in ${(backoffMs / 1000).toFixed(0)}s...`,
      );
      await sleep(backoffMs);
    }
  }
  throw new Error("unreachable");
}

async function main() {
  // ── Validate env ──────────────────────────────────────────────────────
  const apiKey = process.env.CHROMA_API_KEY;
  const tenant = process.env.CHROMA_TENANT;
  const database = process.env.CHROMA_DATABASE ?? "skolnieksai";
  const jinaKey = process.env.JINA_API_KEY;

  if (!apiKey || !tenant) {
    console.error("ERROR: CHROMA_API_KEY and CHROMA_TENANT must be set");
    process.exit(1);
  }
  if (!jinaKey) {
    console.error("ERROR: JINA_API_KEY must be set");
    process.exit(1);
  }

  console.log("=".repeat(60));
  console.log("SkolnieksAI — Re-embed chunks: MiniLM → Jina v3");
  console.log("=".repeat(60));
  console.log(`Source:      ${OLD_COLLECTION} (384-dim)`);
  console.log(`Destination: ${NEW_COLLECTION} (1024-dim)`);
  console.log(`Batch size:  ${EMBED_BATCH_SIZE} chunks, ${INTER_BATCH_DELAY_MS / 1000}s delay`);
  console.log();

  // ── Connect to Chroma Cloud ───────────────────────────────────────────
  const client = new CloudClient({ apiKey, tenant, database });

  const oldColl = await client.getCollection({
    name: OLD_COLLECTION,
    embeddingFunction: new DefaultEmbeddingFunction(),
  });

  const sourceCount = await oldColl.count();
  console.log(`Source collection chunks: ${sourceCount}`);

  if (sourceCount === 0) {
    console.log("Nothing to migrate — source collection is empty.");
    return;
  }

  // Create new collection (cosine space, matching the old one)
  const newColl = await client.getOrCreateCollection({
    name: NEW_COLLECTION,
    metadata: { "hnsw:space": "cosine" },
    embeddingFunction: new DefaultEmbeddingFunction(),
  });

  // Check if there are already chunks in the destination (partial run)
  const existingCount = await newColl.count();
  if (existingCount > 0) {
    console.log(
      `Destination already has ${existingCount} chunks from a previous run.`,
    );
    console.log(
      "Delete the collection first if you want a clean migration, or chunks with duplicate IDs will be skipped by add().",
    );
  }

  console.log(`Created/opened destination collection: ${NEW_COLLECTION}\n`);

  // ── Paginate through old collection ─────────────────────────────────
  // Chroma Cloud caps get() at 300 per request. Paginate with limit+offset.
  console.log("Fetching all chunks from source collection...");

  const allIds: string[] = [];
  const allDocs: (string | null)[] = [];
  const allMetas: (Record<string, unknown> | null)[] = [];

  let offset = 0;
  while (offset < sourceCount) {
    const page = await oldColl.get({
      limit: CHROMA_PAGE_SIZE,
      offset,
      include: ["documents", "metadatas"] as never,
    });

    const pageIds = page.ids;
    if (pageIds.length === 0) break;

    allIds.push(...pageIds);
    allDocs.push(...(page.documents ?? []));
    allMetas.push(...(page.metadatas ?? []));

    console.log(`  Fetched page at offset ${offset}: ${pageIds.length} chunks`);
    offset += pageIds.length;
  }

  console.log(`Fetched ${allIds.length} chunks total.\n`);

  if (allIds.length !== sourceCount) {
    console.error(
      `ERROR: Fetched ${allIds.length} but count() reported ${sourceCount}. Investigate.`,
    );
    process.exit(1);
  }

  // ── Re-embed and write in batches ─────────────────────────────────────
  let totalProcessed = 0;
  const totalBatches = Math.ceil(allIds.length / EMBED_BATCH_SIZE);
  const startTime = Date.now();

  console.log(`Starting re-embedding: ${totalBatches} batches of ${EMBED_BATCH_SIZE}...\n`);

  for (let i = 0; i < allIds.length; i += EMBED_BATCH_SIZE) {
    const batchIds = allIds.slice(i, i + EMBED_BATCH_SIZE);
    const batchDocs = allDocs.slice(i, i + EMBED_BATCH_SIZE);
    const batchMetas = allMetas.slice(i, i + EMBED_BATCH_SIZE);

    const texts = batchDocs.map((d) => d ?? "");

    // Re-embed with Jina v3 (retry on 429)
    const embeddings = await embedWithRetry(texts);

    // Write to new collection with same ids, docs, metadata
    await newColl.add({
      ids: batchIds,
      documents: texts,
      metadatas: batchMetas as Record<string, string | number | boolean>[],
      embeddings,
    });

    totalProcessed += batchIds.length;
    const batchNum = Math.ceil(totalProcessed / EMBED_BATCH_SIZE);
    const elapsed = ((Date.now() - startTime) / 1000).toFixed(0);
    console.log(
      `Batch ${batchNum}/${totalBatches} — ${totalProcessed}/${allIds.length} chunks (${elapsed}s elapsed)`,
    );

    // Delay between batches to stay under Jina's token rate limit
    if (totalProcessed < allIds.length) {
      await sleep(INTER_BATCH_DELAY_MS);
    }
  }

  // ── Verify ────────────────────────────────────────────────────────────
  const newCount = await newColl.count();
  const totalElapsed = ((Date.now() - startTime) / 1000).toFixed(0);
  console.log();
  console.log("=".repeat(60));
  console.log(`Migration complete in ${totalElapsed}s.`);
  console.log(`Source count:      ${sourceCount}`);
  console.log(`Destination count: ${newCount}`);

  if (newCount >= sourceCount) {
    console.log("Counts match. Migration successful.");
  } else {
    console.error(
      `WARNING: Count mismatch! Expected ${sourceCount}, got ${newCount}. Investigate before switching production.`,
    );
    process.exit(1);
  }
}

main().catch((err) => {
  console.error("Fatal error during migration:", err);
  process.exit(1);
});
