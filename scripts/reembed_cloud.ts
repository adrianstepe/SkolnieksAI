/**
 * scripts/reembed_cloud.ts — Re-embed all chunks in Chroma Cloud
 * using @xenova/transformers (Node.js) instead of Python sentence-transformers.
 *
 * Required because the ONNX model produces different embedding vectors than
 * PyTorch, and the retriever now uses the ONNX embeddings for queries.
 * Both must match for L2 distance retrieval to work correctly.
 *
 * Features:
 *   - Retry with exponential backoff on transient errors (connection reset, etc.)
 *   - Inter-batch delay to avoid rate-limiting
 *   - --resume=N flag to skip the first N chunks (resume after a crash)
 *
 * Usage:
 *   npx tsx --env-file=.env.local scripts/reembed_cloud.ts
 *
 * Dry run (shows what would happen without changing anything):
 *   npx tsx --env-file=.env.local scripts/reembed_cloud.ts --dry-run
 *
 * Resume from chunk 1100 after a crash:
 *   npx tsx --env-file=.env.local scripts/reembed_cloud.ts --resume=1100
 */

import { CloudClient, DefaultEmbeddingFunction } from "chromadb";
import { embedTexts } from "../lib/ai/embeddings";

const COLLECTION = "skolnieks_content";
const BATCH_SIZE = 25;            // Smaller batches = less data per request
const INTER_BATCH_DELAY_MS = 500; // Pause between batches to avoid throttling
const MAX_RETRIES = 5;            // Max retries per batch

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function parseResumeArg(): number {
  const arg = process.argv.find((a) => a.startsWith("--resume="));
  if (!arg) return 0;
  const val = parseInt(arg.split("=")[1], 10);
  return isNaN(val) ? 0 : val;
}

/**
 * Execute `fn` with retry + exponential backoff.
 * Only retries on transient errors (connection reset, timeout, etc.)
 */
async function withRetry<T>(
  label: string,
  fn: () => Promise<T>,
  retries = MAX_RETRIES,
): Promise<T> {
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      return await fn();
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      const isTransient =
        msg.includes("ECONNRESET") ||
        msg.includes("ETIMEDOUT") ||
        msg.includes("ENOTFOUND") ||
        msg.includes("fetch failed") ||
        msg.includes("Failed to connect") ||
        msg.includes("socket hang up") ||
        msg.includes("503") ||
        msg.includes("429");

      if (!isTransient || attempt === retries) {
        throw err; // Non-transient or exhausted retries
      }

      const backoffMs = Math.min(1000 * 2 ** attempt, 30_000); // 2s, 4s, 8s, 16s, 30s
      console.warn(
        `\n  ⚠ ${label}: ${msg} — retry ${attempt}/${retries} in ${(backoffMs / 1000).toFixed(0)}s...`,
      );
      await sleep(backoffMs);
    }
  }
  throw new Error("unreachable");
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  const dryRun = process.argv.includes("--dry-run");
  const resumeFrom = parseResumeArg();

  const apiKey = process.env.CHROMA_API_KEY;
  const tenant = process.env.CHROMA_TENANT;
  const database = process.env.CHROMA_DATABASE ?? "skolnieksai";

  if (!apiKey || !tenant) {
    console.error("ERROR: CHROMA_API_KEY and CHROMA_TENANT must be set");
    process.exit(1);
  }

  console.log("=".repeat(60));
  console.log("SkolnieksAI — Re-embed chunks with @xenova/transformers");
  console.log("=".repeat(60));
  console.log(`Collection: ${COLLECTION}`);
  console.log(`Batch size: ${BATCH_SIZE}, delay: ${INTER_BATCH_DELAY_MS}ms`);
  console.log(`Mode:       ${dryRun ? "DRY RUN" : "LIVE — will update embeddings"}`);
  if (resumeFrom > 0) console.log(`Resume from: chunk ${resumeFrom}`);
  console.log();

  const client = new CloudClient({ apiKey, tenant, database });
  const coll = await client.getCollection({
    name: COLLECTION,
    embeddingFunction: new DefaultEmbeddingFunction(),
  });

  const total = await coll.count();
  console.log(`Total chunks: ${total}`);

  if (total === 0) {
    console.log("Nothing to re-embed.");
    return;
  }

  // Warm up the embedding model
  console.log("Loading embedding model (first call)...");
  await embedTexts(["warm up"], "retrieval.passage");
  console.log("Model loaded.\n");

  let processed = 0;
  let updated = 0;
  let offset = resumeFrom;

  while (offset < total) {
    // Fetch batch with retry
    const batch = await withRetry(`GET offset=${offset}`, () =>
      coll.get({
        limit: BATCH_SIZE,
        offset,
        include: ["documents", "metadatas"] as never,
      }),
    );

    const ids = batch.ids;
    const docs = batch.documents ?? [];

    if (ids.length === 0) break;

    // Extract text for embedding
    const texts = docs.map((d: string | null) => (d as string | null) ?? "");

    if (!dryRun) {
      // Generate new embeddings
      const embeddings = await embedTexts(texts, "retrieval.passage");

      // Update with retry
      await withRetry(`UPDATE offset=${offset}`, () =>
        coll.update({ ids, embeddings }),
      );
      updated += ids.length;
    }

    processed += ids.length;
    offset += ids.length;

    const pct = ((offset / total) * 100).toFixed(1);
    process.stdout.write(`  ${offset}/${total} (${pct}%)...\n`);

    // Inter-batch delay to avoid throttling
    if (offset < total) {
      await sleep(INTER_BATCH_DELAY_MS);
    }
  }

  console.log();
  console.log("=".repeat(60));
  if (dryRun) {
    console.log(`DRY RUN complete — ${processed} chunks would be re-embedded.`);
    console.log("Run without --dry-run to apply changes.");
  } else {
    console.log(`Re-embedding complete — ${updated} chunks updated.`);
  }
  console.log("=".repeat(60));
}

main().catch((err) => {
  console.error("Re-embed failed:", err);
  console.error("\nTip: You can resume from the last successful offset with:");
  console.error("  npx tsx --env-file=.env.local scripts/reembed_cloud.ts --resume=<offset>");
  process.exit(1);
});
