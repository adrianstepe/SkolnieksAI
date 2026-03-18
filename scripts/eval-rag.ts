/**
 * scripts/eval-rag.ts
 *
 * RAG quality evaluation — 10 curriculum questions.
 * Checks retrieval recall and response quality.
 *
 * Usage:
 *   npm run eval:rag
 *   npm run eval:rag -- --json   # output results as JSON
 */

import { retrieve } from "../lib/rag/retriever";
import { runRagChain } from "../lib/rag/chain";

// ---------------------------------------------------------------------------
// Test cases — Skola2030 curriculum questions across subjects and grades
// ---------------------------------------------------------------------------

interface TestCase {
  id: string;
  query: string;          // question as a student would ask
  subject: string;
  grade: number;
  expectedKeywords: string[];  // terms that should appear in top chunks
}

const TEST_CASES: TestCase[] = [
  {
    id: "math-7-algebra",
    query: "Kā atrisināt lineāru vienādojumu ar vienu nezināmo?",
    subject: "math",
    grade: 7,
    expectedKeywords: ["vienādojums", "nezināmais", "vērtība"],
  },
  {
    id: "math-10-functions",
    query: "Kas ir funkcijas definīcijas apgabals?",
    subject: "math",
    grade: 10,
    expectedKeywords: ["funkcija", "definīcijas apgabals", "vērtību apgabals"],
  },
  {
    id: "latvian-8-grammar",
    query: "Kādas ir latviešu valodas teikuma galvenās daļas?",
    subject: "latvian",
    grade: 8,
    expectedKeywords: ["teikums", "izteicējs", "priekšmets"],
  },
  {
    id: "latvian-6-text",
    query: "Kā uzrakstīt aprakstu latviešu valodā?",
    subject: "latvian",
    grade: 6,
    expectedKeywords: ["apraksts", "teksts", "valoda"],
  },
  {
    id: "history-9-wwii",
    query: "Kādi bija Otrā pasaules kara cēloņi?",
    subject: "history",
    grade: 9,
    expectedKeywords: ["karš", "cēlonis", "pasaule"],
  },
  {
    id: "science-7-cell",
    query: "Kādas ir dzīvnieku un augu šūnu atšķirības?",
    subject: "science",
    grade: 7,
    expectedKeywords: ["šūna", "augu", "dzīvnieks"],
  },
  {
    id: "english-9-tenses",
    query: "How do I use the present perfect tense in English?",
    subject: "english",
    grade: 9,
    expectedKeywords: ["present perfect", "have", "tense"],
  },
  {
    id: "math-8-geometry",
    query: "Kā aprēķināt trijstūra laukumu?",
    subject: "math",
    grade: 8,
    expectedKeywords: ["trijstūris", "laukums", "formula"],
  },
  {
    id: "social-10-democracy",
    query: "Kādi ir demokrātijas pamatprincipi?",
    subject: "social_studies",
    grade: 10,
    expectedKeywords: ["demokrātija", "pilsoņi", "tiesības"],
  },
  {
    id: "science-8-photosynthesis",
    query: "Izskaidro fotosintēzes procesu!",
    subject: "science",
    grade: 8,
    expectedKeywords: ["fotosintēze", "gaisma", "glikoze"],
  },
];

// ---------------------------------------------------------------------------
// Evaluation logic
// ---------------------------------------------------------------------------

interface EvalResult {
  id: string;
  query: string;
  subject: string;
  grade: number;
  chunksRetrieved: number;
  keywordHits: number;
  keywordRecall: number;   // 0–1
  responsePreview: string; // first 200 chars
  promptTokens: number;
  completionTokens: number;
  costEur: number;
  durationMs: number;
  passed: boolean;
}

function checkKeywords(
  chunks: { content: string }[],
  keywords: string[],
): number {
  const combinedText = chunks.map((c) => c.content.toLowerCase()).join(" ");
  return keywords.filter((kw) =>
    combinedText.includes(kw.toLowerCase()),
  ).length;
}

// DeepSeek pricing (EUR, approximate): $0.028/1M input cached, $0.28/1M miss, $0.42/1M output
// Simplified: $0.14/1M input (avg cache miss), $0.42/1M output → ~€0.38/1M total
const USD_TO_EUR = 0.92;
const INPUT_USD_PER_TOKEN = 0.00000028;  // $0.28/1M
const OUTPUT_USD_PER_TOKEN = 0.00000042; // $0.42/1M

function estimateCost(promptTokens: number, completionTokens: number): number {
  return (
    (promptTokens * INPUT_USD_PER_TOKEN +
      completionTokens * OUTPUT_USD_PER_TOKEN) *
    USD_TO_EUR
  );
}

async function evalCase(tc: TestCase): Promise<EvalResult> {
  const start = Date.now();

  const result = await runRagChain({
    query: tc.query,
    subject: tc.subject,
    grade: tc.grade,
  });

  const durationMs = Date.now() - start;
  const keywordHits = checkKeywords(result.chunks, tc.expectedKeywords);
  const keywordRecall = keywordHits / tc.expectedKeywords.length;
  const costEur = estimateCost(result.usage.prompt_tokens, result.usage.completion_tokens);

  return {
    id: tc.id,
    query: tc.query,
    subject: tc.subject,
    grade: tc.grade,
    chunksRetrieved: result.chunks.length,
    keywordHits,
    keywordRecall,
    responsePreview: result.content.slice(0, 200),
    promptTokens: result.usage.prompt_tokens,
    completionTokens: result.usage.completion_tokens,
    costEur,
    durationMs,
    passed: keywordRecall >= 0.8,
  };
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  const outputJson = process.argv.includes("--json");

  console.log("SkolnieksAI RAG Evaluation");
  console.log("==========================\n");
  console.log(`Running ${TEST_CASES.length} test cases...\n`);

  const results: EvalResult[] = [];
  for (const tc of TEST_CASES) {
    process.stdout.write(`[${tc.id}] ...`);
    try {
      const result = await evalCase(tc);
      results.push(result);
      const status = result.passed ? "PASS" : "FAIL";
      process.stdout.write(
        ` ${status} (recall: ${(result.keywordRecall * 100).toFixed(0)}%, ${result.durationMs}ms, €${result.costEur.toFixed(5)})\n`,
      );
    } catch (err) {
      process.stdout.write(` ERROR: ${(err as Error).message}\n`);
      results.push({
        id: tc.id,
        query: tc.query,
        subject: tc.subject,
        grade: tc.grade,
        chunksRetrieved: 0,
        keywordHits: 0,
        keywordRecall: 0,
        responsePreview: "",
        promptTokens: 0,
        completionTokens: 0,
        costEur: 0,
        durationMs: 0,
        passed: false,
      });
    }
  }

  // Summary
  const passed = results.filter((r) => r.passed).length;
  const avgRecall = results.reduce((s, r) => s + r.keywordRecall, 0) / results.length;
  const totalCost = results.reduce((s, r) => s + r.costEur, 0);
  const avgDuration = results.reduce((s, r) => s + r.durationMs, 0) / results.length;

  console.log("\n--- Summary ---");
  console.log(`Passed:        ${passed}/${results.length}`);
  console.log(`Avg recall:    ${(avgRecall * 100).toFixed(1)}%`);
  console.log(`Total cost:    €${totalCost.toFixed(4)}`);
  console.log(`Avg latency:   ${avgDuration.toFixed(0)}ms`);
  console.log(
    `Acceptance:    ${avgRecall >= 0.8 ? "✓ PASS (>80% recall)" : "✗ FAIL (<80% recall)"}`,
  );

  if (outputJson) {
    console.log("\n--- JSON Results ---");
    console.log(JSON.stringify(results, null, 2));
  }

  process.exit(passed === results.length ? 0 : 1);
}

main().catch((err) => {
  console.error("Eval failed:", err);
  process.exit(1);
});
