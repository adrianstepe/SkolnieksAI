/**
 * scripts/delete-bad-chunks.ts — One-off cleanup of known-bad chunks.
 *
 * Targets three sources confirmed as junk or policy violations in the
 * April 2026 audit of skolnieks_content_v2:
 *
 *   - wikipedia_lv_Dalībnieks:Nikolaj_Kovalyov/Smilšu_kaste.txt   (6 chunks)
 *     Reason: Wikipedia user sandbox page — not curriculum content.
 *
 *   - wikipedia_lv_Jūrniecības_astronomija.txt                     (8 chunks)
 *     Reason: Maritime/navigation astronomy; causes false-positive RAG hits
 *     on general astronomy queries.
 *
 *   - wikipedia_lv_Bioloģija_un_seksuālā_orientācija.txt           (11 chunks)
 *     Reason: Sensitive topic removed pending content policy review.
 *
 * Expected: 25 chunks deleted, collection drops from 2359 → 2334.
 *
 * Usage (review before running — this is DESTRUCTIVE and irreversible):
 *   npx tsx --env-file=.env.local scripts/delete-bad-chunks.ts
 *
 * DO NOT run in CI or as part of any automated pipeline.
 */

import { CloudClient, DefaultEmbeddingFunction } from "chromadb";

const COLLECTION_NAME = "skolnieks_content_v2";
const EXPECTED_DELETIONS = 25;

const TARGETS: Array<{ file: string; expectedChunks: number; reason: string }> = [
  {
    file: "wikipedia_lv_Dalībnieks:Nikolaj_Kovalyov/Smilšu_kaste.txt",
    expectedChunks: 6,
    reason: "Wikipedia user sandbox — not curriculum content",
  },
  {
    file: "wikipedia_lv_Jūrniecības_astronomija.txt",
    expectedChunks: 8,
    reason: "Maritime astronomy — causes false-positive RAG hits",
  },
  {
    file: "wikipedia_lv_Bioloģija_un_seksuālā_orientācija.txt",
    expectedChunks: 11,
    reason: "Sensitive topic — removed pending content policy review",
  },
];

async function main() {
  const apiKey = process.env.CHROMA_API_KEY;
  const tenant = process.env.CHROMA_TENANT;
  const database = process.env.CHROMA_DATABASE ?? "skolnieksai";

  if (!apiKey || !tenant) {
    console.error("ERROR: CHROMA_API_KEY and CHROMA_TENANT must be set");
    process.exit(1);
  }

  console.log("=".repeat(60));
  console.log("SkolnieksAI — Bad Chunk Deletion");
  console.log("=".repeat(60));
  console.log(`Collection : ${COLLECTION_NAME}`);
  console.log(`Tenant     : ${tenant}`);
  console.log(`Database   : ${database}`);
  console.log(`Targets    : ${TARGETS.length} files (${EXPECTED_DELETIONS} chunks expected)`);
  console.log();

  const client = new CloudClient({ apiKey, tenant, database });
  const coll = await client.getCollection({
    name: COLLECTION_NAME,
    embeddingFunction: new DefaultEmbeddingFunction(),
  });

  const countBefore = await coll.count();
  console.log(`Count before: ${countBefore}`);
  console.log();

  // ---------------------------------------------------------------------------
  // Delete one file at a time; verify chunk count before and after each
  // ---------------------------------------------------------------------------
  let totalDeleted = 0;

  for (const target of TARGETS) {
    console.log(`Targeting: ${target.file}`);
    console.log(`  Reason  : ${target.reason}`);
    console.log(`  Expected: ${target.expectedChunks} chunks`);

    // Fetch matching IDs first so we know the exact count before deleting
    const matching = await coll.get({
      where: { source_pdf: target.file },
      include: [] as never,
    });

    const found = matching.ids.length;
    console.log(`  Found   : ${found} chunks`);

    if (found === 0) {
      console.log("  SKIP    : no chunks found — already deleted or filename mismatch");
      console.log();
      continue;
    }

    if (found !== target.expectedChunks) {
      console.warn(
        `  WARNING : expected ${target.expectedChunks} but found ${found} — proceeding anyway`,
      );
    }

    await coll.delete({ where: { source_pdf: target.file } });
    totalDeleted += found;
    console.log(`  Deleted : ${found} chunks ✓`);
    console.log();
  }

  // ---------------------------------------------------------------------------
  // Post-deletion verification
  // ---------------------------------------------------------------------------
  const countAfter = await coll.count();
  const actualDrop = countBefore - countAfter;

  console.log("=".repeat(60));
  console.log("VERIFICATION");
  console.log("=".repeat(60));
  console.log(`Count before   : ${countBefore}`);
  console.log(`Count after    : ${countAfter}`);
  console.log(`Chunks deleted : ${totalDeleted} (reported by get() pre-checks)`);
  console.log(`Actual drop    : ${actualDrop}`);
  console.log(`Expected drop  : ${EXPECTED_DELETIONS}`);

  if (actualDrop === EXPECTED_DELETIONS) {
    console.log(`\nResult: PASS — collection dropped by exactly ${EXPECTED_DELETIONS} as expected.`);
  } else {
    console.warn(
      `\nResult: MISMATCH — expected drop of ${EXPECTED_DELETIONS}, got ${actualDrop}. ` +
        `Investigate before proceeding.`,
    );
    process.exit(1);
  }
}

main().catch((err) => {
  console.error("Deletion script failed:", err);
  process.exit(1);
});
