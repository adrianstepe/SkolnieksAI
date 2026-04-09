/**
 * scripts/smoke_test_retrieval.ts
 * Diagnostic only — no LLM calls, no side effects.
 * Run: npx tsx --env-file=.env.local scripts/smoke_test_retrieval.ts
 */

import { retrieveFromCloud } from "@/lib/rag/retriever";

const QUERIES = [
  "Kas ir fotosintēze?",
  "Paskaidro Ņūtona otro likumu",
  "Kas ir šūnas membrāna?",
  "Latvijas brīvības cīņas",
  "Kā atrisināt kvadrātvienādojumu",
];

async function main() {
  console.log("=== Smoke test: Chroma Cloud retrieval ===\n");

  for (const query of QUERIES) {
    console.log(`Query: "${query}"`);

    const result = await retrieveFromCloud(query, 3);

    if (result.texts.length === 0) {
      console.log("  [NO RESULTS]\n");
      continue;
    }

    for (let i = 0; i < result.texts.length; i++) {
      const dist = result.distances[i]?.toFixed(4) ?? "?";
      const preview = result.texts[i]?.slice(0, 80).replace(/\n/g, " ") ?? "";
      const source = result.sources[i] ?? "unknown";
      console.log(`  [${i + 1}] dist=${dist} | source: ${source}`);
      console.log(`       "${preview}"`);
    }

    console.log(`  hasConfidentMatch: ${result.hasConfidentMatch}\n`);
  }

  console.log("=== Done ===");
}

main().catch((err) => {
  console.error("Fatal:", err);
  process.exit(1);
});
