/**
 * scripts/audit_collection.ts — Audit content sources in Chroma Cloud.
 *
 * Connects to Chroma Cloud, fetches ALL chunks from skolnieks_content,
 * and prints a human-readable breakdown of sources, counts, and quality samples.
 *
 * Usage:
 *   npx tsx --env-file=.env.local scripts/audit_collection.ts
 */

import { CloudClient, DefaultEmbeddingFunction } from "chromadb";

const COLLECTION = "skolnieks_content_v2";
const FETCH_BATCH_SIZE = 200; // Chroma Cloud max page size is 200

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function classifySource(
  sourceName: string,
  sourceType?: unknown,
): "OpenStax" | "Wikipedia" | "Other" {
  // Prefer metadata.source_type when present — filenames don't contain "openstax"
  const t = typeof sourceType === "string" ? sourceType.toLowerCase() : "";
  if (t === "openstax") return "OpenStax";
  if (t.startsWith("wikipedia")) return "Wikipedia";
  // Fallback: inspect filename
  const s = sourceName.toLowerCase();
  if (/wiki/.test(s)) return "Wikipedia";
  return "Other";
}

function pickRandom<T>(arr: T[], n: number): T[] {
  const shuffled = [...arr].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, n);
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  const apiKey = process.env.CHROMA_API_KEY;
  const tenant = process.env.CHROMA_TENANT;
  const database = process.env.CHROMA_DATABASE ?? "skolnieksai";

  if (!apiKey || !tenant) {
    console.error("ERROR: CHROMA_API_KEY and CHROMA_TENANT must be set");
    process.exit(1);
  }

  console.log("=".repeat(60));
  console.log("SkolnieksAI — Collection Source Audit");
  console.log("=".repeat(60));
  console.log(`Collection : ${COLLECTION}`);
  console.log(`Tenant     : ${tenant}`);
  console.log(`Database   : ${database}`);
  console.log();

  const client = new CloudClient({ apiKey, tenant, database });
  const coll = await client.getCollection({
    name: COLLECTION,
    embeddingFunction: new DefaultEmbeddingFunction(),
  });

  const total = await coll.count();
  console.log(`Total chunks in collection: ${total}`);
  if (total === 0) {
    console.log("Collection is empty — nothing to audit.");
    return;
  }
  console.log();

  // -------------------------------------------------------------------------
  // Fetch ALL chunks (paginated)
  // -------------------------------------------------------------------------
  type RawChunk = {
    id: string;
    document: string | null;
    metadata: Record<string, unknown>;
  };

  const allChunks: RawChunk[] = [];
  let offset = 0;

  process.stdout.write("Fetching chunks");
  while (offset < total) {
    const batch = await coll.get({
      limit: FETCH_BATCH_SIZE,
      offset,
      include: ["documents", "metadatas"] as never,
    });

    for (let i = 0; i < batch.ids.length; i++) {
      allChunks.push({
        id: batch.ids[i],
        document: (batch.documents as (string | null)[])[i] ?? null,
        metadata: ((batch.metadatas as Record<string, unknown>[])[i]) ?? {},
      });
    }

    offset += batch.ids.length;
    process.stdout.write(".");
    if (batch.ids.length === 0) break;
    if (offset < total) await sleep(300); // gentle throttle
  }
  console.log(` done.\n`);

  const fetched = allChunks.length;

  // -------------------------------------------------------------------------
  // Inspect first chunk's metadata to discover field names
  // -------------------------------------------------------------------------
  if (allChunks.length > 0) {
    const firstMeta = allChunks[0].metadata;
    console.log("--- First chunk metadata fields ---");
    for (const [k, v] of Object.entries(firstMeta)) {
      console.log(`  ${k}: ${JSON.stringify(v)}`);
    }
    console.log();
  }

  // -------------------------------------------------------------------------
  // Determine the best "source" field to group by
  // Priority: source_pdf > source > source_file > file_path > document > book
  // -------------------------------------------------------------------------
  const SOURCE_FIELD_CANDIDATES = [
    "source_pdf", "source", "source_file", "file_path", "document", "book",
  ];

  let resolvedSourceField = "source_pdf";
  for (const field of SOURCE_FIELD_CANDIDATES) {
    if (allChunks.some((c) => c.metadata[field] !== undefined)) {
      resolvedSourceField = field;
      break;
    }
  }
  console.log(`Using metadata field "${resolvedSourceField}" as source identifier.\n`);

  // -------------------------------------------------------------------------
  // Aggregate by source
  // -------------------------------------------------------------------------
  const sourceCounts = new Map<string, number>();
  const sourceChunks = new Map<string, RawChunk[]>();
  // Tracks one representative source_type per source key for classification
  const sourceTypes = new Map<string, unknown>();

  for (const chunk of allChunks) {
    const rawVal = chunk.metadata[resolvedSourceField];
    const src = rawVal !== undefined ? String(rawVal) : "(no source field)";

    sourceCounts.set(src, (sourceCounts.get(src) ?? 0) + 1);
    if (!sourceChunks.has(src)) {
      sourceChunks.set(src, []);
      sourceTypes.set(src, chunk.metadata["source_type"]);
    }
    sourceChunks.get(src)!.push(chunk);
  }

  const sortedSources = [...sourceCounts.entries()].sort((a, b) => b[1] - a[1]);
  const uniqueSourceCount = sortedSources.length;

  // -------------------------------------------------------------------------
  // Category totals
  // -------------------------------------------------------------------------
  let openstaxTotal = 0;
  let wikiTotal = 0;
  let otherTotal = 0;

  for (const [src, count] of sortedSources) {
    const cat = classifySource(src, sourceTypes.get(src));
    if (cat === "OpenStax") openstaxTotal += count;
    else if (cat === "Wikipedia") wikiTotal += count;
    else otherTotal += count;
  }

  const pct = (n: number) =>
    fetched > 0 ? ((n / fetched) * 100).toFixed(1) : "0.0";

  // -------------------------------------------------------------------------
  // Print report
  // -------------------------------------------------------------------------
  console.log("=".repeat(60));
  console.log("SUMMARY");
  console.log("=".repeat(60));
  console.log(`Fetched chunks     : ${fetched} (collection reports ${total})`);
  console.log(`Unique sources     : ${uniqueSourceCount}`);
  console.log();
  console.log("Estimated category split:");
  console.log(`  OpenStax   : ${openstaxTotal} chunks (${pct(openstaxTotal)}%)`);
  console.log(`  Wikipedia  : ${wikiTotal} chunks (${pct(wikiTotal)}%)`);
  console.log(`  Other      : ${otherTotal} chunks (${pct(otherTotal)}%)`);
  console.log();

  console.log("=".repeat(60));
  console.log("TOP 20 SOURCES BY CHUNK COUNT");
  console.log("=".repeat(60));
  const top20 = sortedSources.slice(0, 20);
  const longestName = Math.min(60, Math.max(...top20.map(([s]) => s.length)));
  for (const [src, count] of top20) {
    const tag = classifySource(src, sourceTypes.get(src));
    const label = src.length > 60 ? src.slice(0, 57) + "..." : src;
    console.log(`  [${tag.padEnd(9)}] ${label.padEnd(longestName)}  ${count} chunks`);
  }
  if (sortedSources.length > 20) {
    console.log(`  ... and ${sortedSources.length - 20} more sources`);
  }
  console.log();

  // -------------------------------------------------------------------------
  // Sample 3 random chunks from each top-5 source
  // -------------------------------------------------------------------------
  console.log("=".repeat(60));
  console.log("QUALITY SAMPLES — 3 random chunks from each top-5 source");
  console.log("=".repeat(60));

  const top5 = sortedSources.slice(0, 5);
  for (const [src] of top5) {
    const chunks = sourceChunks.get(src) ?? [];
    const samples = pickRandom(chunks, 3);
    console.log(`\nSource: ${src}  (${chunks.length} chunks total)`);
    console.log("-".repeat(56));
    for (let i = 0; i < samples.length; i++) {
      const doc = samples[i].document ?? "(empty)";
      const preview = doc.replace(/\s+/g, " ").trim().slice(0, 200);
      console.log(`  [${i + 1}] ${preview}${doc.length > 200 ? "…" : ""}`);
      // Also show a few metadata fields for context
      const meta = samples[i].metadata;
      const metaSnip = ["subject", "source_type", "grade_min", "grade_max"]
        .filter((k) => meta[k] !== undefined)
        .map((k) => `${k}=${JSON.stringify(meta[k])}`)
        .join(", ");
      if (metaSnip) console.log(`      meta: ${metaSnip}`);
    }
  }

  console.log();
  console.log("=".repeat(60));
  console.log("Audit complete.");
  console.log("=".repeat(60));
}

main().catch((err) => {
  console.error("Audit failed:", err);
  process.exit(1);
});
