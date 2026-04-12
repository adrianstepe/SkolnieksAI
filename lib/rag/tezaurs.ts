/**
 * lib/rag/tezaurs.ts — Tēzaurs.lv morphological lookup for Latvian grammar queries.
 *
 * Fetches authoritative inflection data from the University of Latvia's
 * Tēzaurs API and formats it for injection into the LLM context.
 *
 * API: https://api.tezaurs.lv
 * Endpoint used: GET /v1/inflections/{lemma}
 *
 * KNOWN LIMITATION — inflected-form queries do not resolve:
 *   Works:     base-form lemmas  (skolēns, iet, skaists)
 *   Fails:     inflected forms   (skolēnam, gāju, skaistā) → API returns
 *              Vārdšķira "Reziduālis", which is filtered out and returns null.
 *   Root cause: /v1/analyze/ and /v1/suitable_paradigm/ are 404 on
 *              api.tezaurs.lv; morpho.tezaurs.lv has an expired SSL cert
 *              (verified 2026-04) so lemmatization before lookup is impossible.
 *   Future fix: when morpho.tezaurs.lv is restored, add a /analyze/ pre-lookup
 *              phase to resolve inflected forms to lemmas before /v1/inflections/.
 *   Impact:    low — Tēzaurs now runs in parallel with RAG so a no-op costs
 *              nothing in latency.
 */

const TEZAURS_API = "https://api.tezaurs.lv";
const TIMEOUT_MS = 2000;

// Normalized RAG subject keys that auto-trigger Tēzaurs lookup
const TEZAURS_SUBJECTS = new Set(["latvian"]);

// Grammar-trigger keyword stems (case-insensitive substring match).
// If ANY appear in the user query, Tēzaurs lookup runs regardless of subject.
const GRAMMAR_TRIGGERS = [
  "locījum", "deklināc", "konjugāc", "vārdšķir", "dzimt",
  "vienskaitl", "daudzskaitl", "kā loka", "kā loku", "kāda forma",
  "kāds laiks", "kā raksta", "kā pareizi", "ģenitīv", "datīv",
  "akuzatīv", "instrumentāl", "lokatīv", "nominatīv", "vokatīv",
  "tagadne", "pagātne", "nākotne", "darbības vārds", "lietvārds",
  "īpašības vārds", "divdabis",
];

// Stems of grammar meta-words — excluded from lemma extraction since they
// describe grammar concepts, not the words the student is asking about.
const GRAMMAR_META_STEMS = [
  "locījum", "deklināc", "konjugāc", "vārdšķir",
  "vienskaitl",  // vienskaitlis — base stem
  "vienskaitļ",  // l↔ļ palatalization: vienskaitļa, vienskaitļu (gen/dat forms)
  "daudzskaitl", // daudzskaitlis — base stem
  "daudzskaitļ", // l↔ļ palatalization: daudzskaitļa, daudzskaitļu (gen/dat forms)
  "darbīb",      // darbība/darbības — filters "darbības vārdu" spurious lemma
  "ģenitīv", "datīv", "akuzatīv", "instrumentāl",
  "lokatīv", "nominatīv", "vokatīv",
  "tagadn", "pagātn", "nākotn",
  "forma", "lokot", "loku", "loka",
  "divdab", "lietvārd", "īpašīb",
];

const LATVIAN_STOP_WORDS = new Set([
  // Pronouns
  "es", "tu", "viņš", "viņa", "mēs", "jūs", "viņi", "viņas",
  "kas", "ko", "kāds", "kāda", "kādā", "kādam", "kādu", "kādas",
  "kurš", "kura", "šis", "šī", "tas", "tā", "to", "tam", "tajā",
  "šo", "šie", "šīs", "sev", "mani", "tevi",
  // Prepositions
  "ar", "bez", "par", "uz", "no", "pie", "pēc", "līdz", "starp",
  "gar", "pār", "caur", "ap",
  // Conjunctions / particles
  "un", "vai", "bet", "jo", "ka", "kad", "ja", "lai", "kā",
  "ir", "nav", "jā", "nē", "tikai", "vēl", "pat", "jau", "nu",
  "kur", "kāpēc", "cik", "gan", "arī", "taču", "tomēr", "ne",
  // Common auxiliaries
  "būt", "var", "lūdzu",
  // Meta-words about "the word" itself
  "vārds", "vārda", "vārdu", "vārdā", "vārdam", "vārdiem",
]);

// POS values we want inflection tables for
const TARGET_POS = new Set([
  "Lietvārds",
  "Darbības vārds",
  "Īpašības vārds",
]);

// ── Types ────────────────────────────────────────────────────────────────────

interface InflectionForm {
  Vārds: string;
  Vārdšķira: string;
  Skaitlis?: string;
  Locījums?: string;
  Dzimte?: string;
  Deklinācija?: string;
  Noteiktība?: string;
  Pakāpe?: string;
  Laiks?: string;
  Persona?: string;
  Izteiksme?: string;
  Kārta?: string;
  Konjugācija?: string;
  Noliegums?: string;
}

interface LemmaResult {
  lemma: string;
  pos: string;
  forms: InflectionForm[];
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function shouldTrigger(query: string, subject: string): boolean {
  if (TEZAURS_SUBJECTS.has(subject)) return true;
  const lower = query.toLowerCase();
  return GRAMMAR_TRIGGERS.some((trigger) => lower.includes(trigger));
}

function isGrammarMeta(word: string): boolean {
  const lower = word.toLowerCase();
  return GRAMMAR_META_STEMS.some((stem) => lower.includes(stem));
}

/**
 * Extract candidate lemmas from a query using stop-word filtering.
 * Since the /analyzesentence endpoint is unavailable (morpho.tezaurs.lv SSL
 * cert expired), we tokenize and filter heuristically. Returns at most 3.
 */
function extractCandidateLemmas(query: string): string[] {
  const seen = new Set<string>();
  return query
    .split(/[\s,.!?;:()"""„'—–\-/]+/)
    .filter(Boolean)
    .filter((t) => t.length > 2)
    .filter((t) => !LATVIAN_STOP_WORDS.has(t.toLowerCase()))
    .filter((t) => !isGrammarMeta(t))
    .filter((t) => {
      const lower = t.toLowerCase();
      if (seen.has(lower)) return false;
      seen.add(lower);
      return true;
    })
    .slice(0, 3);
}

async function fetchInflections(lemma: string): Promise<LemmaResult | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const url = `${TEZAURS_API}/v1/inflections/${encodeURIComponent(lemma)}`;
    const res = await fetch(url, { signal: controller.signal });
    if (!res.ok) return null;
    const data: InflectionForm[][] = await res.json();
    if (!Array.isArray(data) || data.length === 0) return null;
    const paradigm = data[0];
    if (!Array.isArray(paradigm) || paradigm.length === 0) return null;
    const pos = paradigm[0].Vārdšķira;
    if (!TARGET_POS.has(pos)) return null;
    return { lemma, pos, forms: paradigm };
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

// ── Formatters ───────────────────────────────────────────────────────────────

const CASE_ORDER = [
  "Nominatīvs", "Ģenitīvs", "Datīvs", "Akuzatīvs",
  "Instrumentālis", "Lokatīvs", "Vokatīvs",
];

function formatNoun(result: LemmaResult): string {
  const first = result.forms[0];
  const gender = first.Dzimte ?? "";
  const decl = first.Deklinācija ?? "";

  let out = `Vārds: ${result.lemma}\n`;
  out += "Vārdšķira: Lietvārds";
  if (gender && gender !== "Nepiemīt") out += `, ${gender.toLowerCase()} dzimte`;
  if (decl && decl !== "Nepiemīt") out += `, ${decl}. deklinācija`;
  out += "\n";

  for (const number of ["Vienskaitlis", "Daudzskaitlis"]) {
    const caseForms = result.forms.filter((f) => f.Skaitlis === number);
    if (caseForms.length === 0) continue;
    out += `${number}:\n`;
    for (const caseName of CASE_ORDER) {
      const form = caseForms.find((f) => f.Locījums === caseName);
      if (form) out += `  ${caseName}: ${form.Vārds}\n`;
    }
  }

  return out.trimEnd();
}

function formatAdjective(result: LemmaResult): string {
  // Only base grade (Pamata), indefinite (Nenoteiktā), non-negated
  const baseForms = result.forms.filter(
    (f) =>
      (f.Pakāpe === "Pamata" || !f.Pakāpe) &&
      (f.Noteiktība === "Nenoteiktā" || !f.Noteiktība) &&
      (f.Noliegums === "Nē" || !f.Noliegums),
  );

  let out = `Vārds: ${result.lemma}\n`;
  out += "Vārdšķira: Īpašības vārds\n";

  for (const gender of ["Vīriešu", "Sieviešu"]) {
    for (const number of ["Vienskaitlis", "Daudzskaitlis"]) {
      const subset = baseForms.filter(
        (f) => f.Dzimte === gender && f.Skaitlis === number,
      );
      if (subset.length === 0) continue;
      out += `${number} (${gender.toLowerCase()} dzimte):\n`;
      for (const caseName of CASE_ORDER) {
        const form = subset.find((f) => f.Locījums === caseName);
        if (form) out += `  ${caseName}: ${form.Vārds}\n`;
      }
    }
  }

  return out.trimEnd();
}

function formatVerb(result: LemmaResult): string {
  const first = result.forms[0];
  const conj = first.Konjugācija ?? "";

  let out = `Vārds: ${result.lemma}\n`;
  out += "Vārdšķira: Darbības vārds";
  if (conj && conj !== "Nepiemīt") out += `, ${conj}. konjugācija`;
  out += "\n";

  // Indicative active voice, non-negated only
  const indicative = result.forms.filter(
    (f) =>
      f.Izteiksme === "Īstenības" &&
      f.Kārta === "Darāmā" &&
      f.Noliegums === "Nē",
  );

  for (const tense of ["Tagadne", "Pagātne", "Nākotne"]) {
    const tenseForms = indicative.filter((f) => f.Laiks === tense);
    if (tenseForms.length === 0) continue;
    out += `${tense}:\n`;

    const sg1 = tenseForms.find((f) => f.Persona === "1" && f.Skaitlis === "Vienskaitlis");
    const sg2 = tenseForms.find((f) => f.Persona === "2" && f.Skaitlis === "Vienskaitlis");
    const p3 = tenseForms.find((f) => f.Persona === "3");
    const pl1 = tenseForms.find((f) => f.Persona === "1" && f.Skaitlis === "Daudzskaitlis");
    const pl2 = tenseForms.find((f) => f.Persona === "2" && f.Skaitlis === "Daudzskaitlis");

    if (sg1) out += `  es ${sg1.Vārds}\n`;
    if (sg2) out += `  tu ${sg2.Vārds}\n`;
    if (p3) out += `  viņš/viņa ${p3.Vārds}\n`;
    if (pl1) out += `  mēs ${pl1.Vārds}\n`;
    if (pl2) out += `  jūs ${pl2.Vārds}\n`;
  }

  return out.trimEnd();
}

function formatLemmaResult(result: LemmaResult): string {
  switch (result.pos) {
    case "Lietvārds":
      return formatNoun(result);
    case "Darbības vārds":
      return formatVerb(result);
    case "Īpašības vārds":
      return formatAdjective(result);
    default:
      return "";
  }
}

// ── Main export ──────────────────────────────────────────────────────────────

/**
 * Fetches morphological inflection data from Tēzaurs.lv for Latvian grammar
 * queries. Returns a formatted context block to inject before the LLM call,
 * or null if the query doesn't warrant a lookup or the API fails.
 *
 * Runs only for subject="latvian" OR when the query contains grammar-trigger
 * keywords. All API calls have a 2s timeout; failures degrade gracefully.
 */
export async function fetchTezaurusContext(
  userQuery: string,
  subject: string,
): Promise<string | null> {
  if (!shouldTrigger(userQuery, subject)) return null;

  const t0 = performance.now();
  const candidates = extractCandidateLemmas(userQuery);

  if (candidates.length === 0) {
    console.log("[tezaurs] triggered but no candidate lemmas extracted");
    return null;
  }

  const results = await Promise.allSettled(
    candidates.map((lemma) => fetchInflections(lemma)),
  );

  const successful: LemmaResult[] = [];
  for (const r of results) {
    if (r.status === "fulfilled" && r.value) {
      successful.push(r.value);
    }
  }

  const elapsed = Math.round(performance.now() - t0);
  console.log(
    `[tezaurs] triggered subject=${subject} lemmas=[${candidates.join(",")}] ` +
      `success=${successful.length}/${candidates.length} latency=${elapsed}ms`,
  );

  if (successful.length === 0) return null;

  const blocks = successful.map(formatLemmaResult).filter(Boolean);
  if (blocks.length === 0) return null;

  return (
    "═══ AUTORITATĪVI VALODNIECISKI DATI (no Tēzaurs.lv) ═══\n" +
    "Šie ir pārbaudīti dati no Latvijas Universitātes valodas datubāzes. " +
    "Lieto tos kā autoritatīvu avotu — ja tavi citi avoti tiem runā pretī, šie dati ir pareizi.\n\n" +
    blocks.join("\n\n")
  );
}
