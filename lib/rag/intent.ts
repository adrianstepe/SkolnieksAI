/**
 * lib/rag/intent.ts — Heuristic intent classifier for SkolnieksAI RAG pipeline.
 *
 * Pure regex/keyword classification — no LLM call, no async.
 * Default: AMBIGUOUS (false negatives safer than false positives).
 * Latvian diacritics handled via Unicode-aware regex with `u` + `i` flags.
 *
 * RULE CATALOG (first match wins within each tier):
 *
 *   GENERATIVE — query shape signals no factual lookup needed:
 *     G1  Math expression with operators: /\d+\s*[+\-*\/=^]\s*\d+/
 *     G2  LaTeX delimiters: $...$ or $$...$$
 *     G3  Unicode math symbols: √ ² ³ ∫ ∑ π ≈ ≤ ≥ ÷ ×
 *     G4  Code fences ``` or common programming keywords
 *     G5  Latvian generative verbs at query start (uzraksti, atrisini, …)
 *     G6  Short greetings/small talk ≤ 25 chars
 *     G7  Assistant meta-questions (kā tev iet, kas tu esi, …)
 *
 *   LATVIA_SPECIFIC — needs Latvian sources; OpenStax corpus weak here:
 *     L1  Latvian history terms (Brīvības cīņas, deportācijas, 1918, …)
 *     L2  Latvian literature (Rainis, Aspazija, Blaumanis, dainas, …)
 *     L3  Latvian geography (Latgale, Daugava, Rīga, …)
 *     L4  Curriculum/exam meta (Skola2030, VISC, centralizētais eksāmens, …)
 *     L5  Latvian civics/law (Saeima, Satversme, likumi.lv, …)
 *
 *   STEM_FACTUAL — likely covered by OpenStax in RAG corpus:
 *     S1  Latvian STEM concept terms (fotosintēze, atoms, gravitācija, …)
 *     S2  English STEM terms in mixed-language queries
 *     S3  "Kas ir [STEM term]" definition patterns
 *
 *   AMBIGUOUS — default; everything else falls through here.
 */

export type Intent = "GENERATIVE" | "STEM_FACTUAL" | "LATVIA_SPECIFIC" | "AMBIGUOUS";

export interface ClassifyResult {
  intent: Intent;
  matchedRule: string;
}

// ── GENERATIVE rules ────────────────────────────────────────────────────────

const R_MATH_EXPR      = /\d+\s*[+\-*/=^]\s*\d+/u;
const R_LATEX          = /\$\$?.+?\$\$?/su;
const R_MATH_SYMBOLS   = /[√²³∫∑π≈≤≥÷×]/u;
const R_CODE           = /```|(?:function\s|def\s|import\s|console\.log|print\(|<html|SELECT\s|class\s+\w+:)/iu;
const R_GEN_VERBS      = /^(uzraksti|sastādi|izveido|sacerē|noformulē|pārtulko|iztulko|atrisini|aprēķini|izrēķini|pārfrāzē|saīsinā|paplašini)\b/iu;
const R_GREETING_SHORT = /^(čau|sveiki?|labdien|labrīt|labvakar|paldies|labi|jā|nē|ok|okay|hi|hello|hey)\b/iu;
const R_ASSISTANT_META = /^(kā tev iet|kas tu esi|ko tu vari|kurš tevi)/iu;

// ── LATVIA_SPECIFIC rules ───────────────────────────────────────────────────

const R_LV_HISTORY  = /\b(brīvības cīņas|barikādes|atmoda|okupācija|deportācijas|ulmanis|čakste|latvijas vēsture|1918|1991|18\.\s*novembris)\b/iu;
const R_LV_LIT      = /\b(rainis|aspazija|blaumanis|poruks|čaks|vācietis|belševica|latviešu literatūra|dainas)\b/iu;
const R_LV_GEO      = /\b(latgale|kurzeme|vidzeme|zemgale|sēlija|daugava|gauja|rīga|daugavpils|liepāja)\b/iu;
const R_CURRICULUM  = /\b(skola2030|visc|izm|centralizēt|eksāmen|valsts pārbaudes)\b/iu;
const R_LV_CIVICS   = /\b(saeima|satversme|likumi\.lv|pašvaldīb)\b/iu;

// ── STEM_FACTUAL rules ──────────────────────────────────────────────────────

const R_STEM_LV   = /\b(fotosintēze|šūna|atom|molekul|gravitāc|enerģij|spēk|ātrum|paātrinā|funkcij|integrāl|atvasinājum|vienādojum|reakcij|elektron|proton|neitron)\b/iu;
const R_STEM_EN   = /\b(photosynthesis|cell|atom|molecule|gravity|energy|force|velocity|acceleration|function|integral|derivative|equation|reaction)\b/iu;
const R_KAS_IR    = /^kas\s+ir\s+\w*(atom|molekul|enerģij|gravitāc|šūna|fotosintēz|elektron|proton|reakcij|integral|funkcij)/iu;

// ── Classifier ──────────────────────────────────────────────────────────────

export function classifyIntent(query: string): ClassifyResult {
  const q = query.trim();

  // GENERATIVE — check shape first; if query is a computation/generation task, skip corpus
  if (R_MATH_EXPR.test(q))                        return { intent: "GENERATIVE", matchedRule: "G1:math_expr" };
  if (R_LATEX.test(q))                            return { intent: "GENERATIVE", matchedRule: "G2:latex" };
  if (R_MATH_SYMBOLS.test(q))                     return { intent: "GENERATIVE", matchedRule: "G3:math_symbols" };
  if (R_CODE.test(q))                             return { intent: "GENERATIVE", matchedRule: "G4:code" };
  if (R_GEN_VERBS.test(q))                        return { intent: "GENERATIVE", matchedRule: "G5:gen_verbs" };
  if (q.length <= 25 && R_GREETING_SHORT.test(q)) return { intent: "GENERATIVE", matchedRule: "G6:greeting" };
  if (R_ASSISTANT_META.test(q))                   return { intent: "GENERATIVE", matchedRule: "G7:meta" };

  // LATVIA_SPECIFIC — needs Latvian web sources; RAG corpus (OpenStax EN) weak here
  if (R_LV_HISTORY.test(q))  return { intent: "LATVIA_SPECIFIC", matchedRule: "L1:lv_history" };
  if (R_LV_LIT.test(q))      return { intent: "LATVIA_SPECIFIC", matchedRule: "L2:lv_lit" };
  if (R_LV_GEO.test(q))      return { intent: "LATVIA_SPECIFIC", matchedRule: "L3:lv_geo" };
  if (R_CURRICULUM.test(q))  return { intent: "LATVIA_SPECIFIC", matchedRule: "L4:curriculum" };
  if (R_LV_CIVICS.test(q))   return { intent: "LATVIA_SPECIFIC", matchedRule: "L5:lv_civics" };

  // STEM_FACTUAL — likely in OpenStax RAG corpus; LLM handles remainder well
  if (R_KAS_IR.test(q))    return { intent: "STEM_FACTUAL", matchedRule: "S3:kas_ir_stem" };
  if (R_STEM_LV.test(q))   return { intent: "STEM_FACTUAL", matchedRule: "S1:stem_lv" };
  if (R_STEM_EN.test(q))   return { intent: "STEM_FACTUAL", matchedRule: "S2:stem_en" };

  return { intent: "AMBIGUOUS", matchedRule: "default" };
}

// ── Routing helpers ──────────────────────────────────────────────────────────

/** GENERATIVE queries need no corpus lookup — skip RAG entirely. */
export function shouldSkipRag(intent: Intent): boolean {
  return intent === "GENERATIVE";
}

/**
 * Returns true when web search should be bypassed after a RAG miss.
 *   GENERATIVE      → skip (no lookup needed at all)
 *   STEM_FACTUAL    → skip (LLM general knowledge handles STEM well enough;
 *                     hasConfidentRag doesn't change this — both branches skip)
 *   LATVIA_SPECIFIC → search (web earns its keep here; allowlist applies)
 *   AMBIGUOUS       → search (existing pipeline)
 */
export function shouldSkipWebSearch(intent: Intent, hasConfidentRag: boolean): boolean {
  void hasConfidentRag; // reserved: may gate AMBIGUOUS in a future tuning pass
  if (intent === "GENERATIVE") return true;
  if (intent === "STEM_FACTUAL") return true;
  return false;
}

/**
 * Controls Tavily include_domains scope passed to webSearch.
 *   LATVIA_SPECIFIC → "allowlist" (.gov.lv, lv.wikipedia.org, …)
 *   everything else → "open"   (no domain restriction)
 */
export function getWebSearchDomainStrategy(intent: Intent): "allowlist" | "open" {
  return intent === "LATVIA_SPECIFIC" ? "allowlist" : "open";
}
