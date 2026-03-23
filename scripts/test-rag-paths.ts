/**
 * scripts/test-rag-paths.ts
 *
 * Sanity check: confirm which RAG path each test query would take.
 * Requires the Python RAG server to be running (npm run dev + uvicorn).
 *
 * Run:
 *   npx tsx scripts/test-rag-paths.ts
 */

import { retrieveContext, RAG_DISTANCE_THRESHOLD } from "@/lib/rag-client";
import { webSearch } from "@/lib/search/web";

// ── Test queries ────────────────────────────────────────────────────────────
const TEST_QUERIES = [
  {
    query: "Kāda ir Pitagora teorēma?",
    expectedPath: "A",
    reason: "Classic maths theorem — should be in Skola2030 math PDFs",
  },
  {
    query: "Kas notika Latvijā 2025. gada novembrī?",
    expectedPath: "B",
    reason: "Recent event — not in static curriculum docs, requires web search",
  },
  {
    query: "banana space rocket recipe",
    expectedPath: "C",
    reason: "Nonsense query — nothing in RAG or educational web results",
  },
];

// ── Helpers ─────────────────────────────────────────────────────────────────

function pathLabel(path: "A" | "B" | "C"): string {
  return {
    A: "✅ Path A — RAG confident",
    B: "🌐 Path B — web search fallback",
    C: "❌ Path C — no results, honest refusal",
  }[path];
}

async function determinePathForQuery(query: string): Promise<{
  path: "A" | "B" | "C";
  distances: number[];
  chunks: number;
  webResults: number;
}> {
  // Step 1: RAG retrieval
  const raw = await retrieveContext(query, 3);

  if (raw.hasConfidentMatch) {
    return { path: "A", distances: raw.distances, chunks: raw.texts.length, webResults: 0 };
  }

  // Step 2: Web search
  let webCount = 0;
  try {
    const results = await webSearch(query, 3);
    webCount = results.length;
  } catch {
    webCount = 0;
  }

  if (webCount > 0) {
    return { path: "B", distances: raw.distances, chunks: raw.texts.length, webResults: webCount };
  }

  return { path: "C", distances: raw.distances, chunks: raw.texts.length, webResults: 0 };
}

// ── Main ────────────────────────────────────────────────────────────────────

async function main() {
  console.log("=".repeat(70));
  console.log("SkolnieksAI — RAG path sanity check");
  console.log(`RAG_DISTANCE_THRESHOLD: ${RAG_DISTANCE_THRESHOLD}`);
  console.log("=".repeat(70));

  // First, audit ChromaDB contents
  const RAG_API_URL = process.env.RAG_API_URL ?? "http://localhost:8001";
  try {
    const auditRes = await fetch(`${RAG_API_URL}/audit`);
    if (auditRes.ok) {
      const audit = await auditRes.json() as { total_chunks: number; sources: Array<{ source_pdf: string }> };
      console.log(`\n📚 ChromaDB: ${audit.total_chunks} chunks indexed`);
      const pdfs = audit.sources?.map((s) => s.source_pdf) ?? [];
      if (pdfs.length > 0) {
        console.log(`   Sampled PDFs: ${pdfs.slice(0, 5).join(", ")}${pdfs.length > 5 ? ` … +${pdfs.length - 5} more` : ""}`);
      } else {
        console.log("   ⚠ No PDFs found — run npm run ingest first!");
      }
    }
  } catch (err) {
    console.warn(`\n⚠ Could not reach RAG server at ${RAG_API_URL}/audit — is it running?`);
    console.warn(`  Start it with: uvicorn rag_server:app --port 8001`);
  }

  console.log();

  let allPassed = true;
  for (const tc of TEST_QUERIES) {
    console.log(`Query: "${tc.query}"`);
    console.log(`Expected: ${tc.expectedPath} (${tc.reason})`);

    try {
      const result = await determinePathForQuery(tc.query);

      const match = result.path === tc.expectedPath;
      if (!match) allPassed = false;

      console.log(`Actual:   ${pathLabel(result.path)} ${match ? "✓" : "✗ UNEXPECTED"}`);
      console.log(
        `  RAG: ${result.chunks} chunk(s)` +
        (result.distances.length > 0 ? `, distances=[${result.distances.map((d) => d.toFixed(3)).join(", ")}]` : ", no distances") +
        `, confident=${result.path === "A"}`,
      );
      if (result.path !== "A") {
        console.log(`  Web: ${result.webResults} result(s)`);
      }
    } catch (err) {
      console.log(`  ERROR: ${err instanceof Error ? err.message : String(err)}`);
      allPassed = false;
    }

    console.log();
  }

  console.log("=".repeat(70));
  console.log(allPassed ? "✅ All paths as expected." : "⚠ Some paths differed from expected — review above.");
  console.log("=".repeat(70));
}

main().catch((err) => {
  console.error("Test failed:", err);
  process.exit(1);
});
