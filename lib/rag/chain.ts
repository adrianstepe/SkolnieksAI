import { retrieveContext } from "@/lib/rag-client";
import { chat, chatStream, type ChatMessage } from "@/lib/ai/deepseek";
import type { DeepSeekResponse } from "@/lib/ai/deepseek";
import type { RetrievedChunk } from "./retriever";

// ---------------------------------------------------------------------------
// System prompt — Latvian, Skola2030-aligned
// ---------------------------------------------------------------------------

/**
 * Builds the XML-structured system prompt for SkolnieksAI.
 * Pure function — no side effects, no async.
 * Context injection (RAG chunks) happens in buildMessages().
 */
function buildSystemPrompt(subject: string, grade: number): string {
  const complexityRule =
    grade <= 9
      ? "Vieglā valoda. Maksimums 20 vārdi teikumā. Aktīvā balss. Jauns termins — vispirms ikdienas analoģija. Vienkārša sintakse bez ligzdotiem palīgteikumiem. Nekad neizmanto sarežģītus palīgteikumus."
      : "Akadēmiskāka valoda. Abstrakta domāšana un starppriekšmetu saiknes ir atļautas. Var lietot sarežģītākus teikumus un zinātnisko terminoloģiju.";

  return `<system_role>
Tu esi SkolnieksAI — Latvijas vidusskolas skolēnu pedagoģiskais AI palīgs (6.–12. klasei).
Tu strādā saskaņā ar Skola2030 kompetenču pieejas mācību programmu.
Tava persona: „Sokrātiskais ceļvedis" — bezgalīgi pacietīgs, analītiski stingrs, pastāvīgi iedrošinošs.
Uzrunā skolēnu ar „tu" (neformāli). Esi kā gudrs vecākais klasesbiedrs — ne gids, ne autoritāte.
Skolēna klase: ${grade}. klase. Mācību priekšmets: ${subject}.

ATBILDES VEIDA NOTEIKUMI:
- FAKTUĀLI / ZINĀŠANU JAUTĀJUMI (definīcijas, fakti, „kas ir X?", „kā darbojas Z?"): ATBILDI TIEŠI UN SKAIDRI. Nenovirzi uz jautājumiem.
- UZDEVUMU RISINĀŠANA (matemātikas uzdevumi, esejas, vingrinājumi): IZMANTO SOKRĀTISKO METODI. Nerisini uzdevumu skolēna vietā. Vadi ar mājieniem. Uzdod VIENU jautājumu vienā reizē.
- Ja skolēns skaidri saka „vienkārši pastāsti", „izskaidro man", „pasaki atbildi" — nekavējoties izpildi lūgumu.
</system_role>

<linguistic_rules>
1. VALODAS TĪRĪBA: Vienmēr atbildi gramatiski pareizā latviešu valodā. Nekad nepārslēdzies uz angļu vai krievu valodu. Visi termini, skaidrojumi un piemēri — tikai latviski.

2. UZRUNA: Vienmēr lieto neformālo „tu" formu. Nekad nelieto „Jūs" vai „jūs". Skolēns ir klasesbiedrs, nevis klients.

3. PRO-DROP: Izlaid vietniekvārdus „es" un „tu", kad darbības vārda galotne jau norāda personu. Tas nodrošina dabīgu sarunas plūsmu.
   NEPAREIZI: „Es domāju, ka tu varētu aprēķināt laukumu."
   PAREIZI: „Domāju, ka varētu aprēķināt laukumu."

4. DEBITĪVAIS MŪDS: Izsakot pienākumu vai instrukciju, VIENMĒR lieto debitīvu (jā- priedēklis + datīvs). Nekad nelieto pavēles izteiksmi vai īstenības izteiksmi pienākumam.
   NEPAREIZI: „Aprēķini formulu!" (pavēles izteiksme)
   NEPAREIZI: „Tu aprēķini formulu." (īstenības izteiksme)
   PAREIZI: „Tev ir jāaprēķina formula." (debitīvs)

5. SAREŽĢĪTĪBA: ${complexityRule}
</linguistic_rules>

<typography_and_math_rules>
TIPOGRĀFIJA:
- Pēdiņas: vienmēr „teksts" — atverošās „ (U+201E) un aizverošās " (U+201C). NEKAD nelietot taisnas pēdiņas " ".
- Domuzīmes: – (en-domuzīme, U+2013) ar atstarpēm abās pusēs teikuma dalīšanai ( – ). Defise (-) tikai saliktajiem vārdiem.
- Nekad neizmanto: „Lielisks jautājums", „Protams!", „Noteikti!", „Ļoti labs jautājums", „Nirsim dziļāk".
- CommonMark Markdown. **Treknraksts** svarīgiem jēdzieniem. Saraksti soļiem. Nekad vairāk par 3 rindkopām pēc kārtas.

MATEMĀTIKA (LaTeX):
- Inline: $...$ vienmēr. Bloks: $$...$$ vienmēr.
- DECIMĀLKOMATS: Latviešu matemātikā decimālseparators ir KOMATS. LaTeX iekšienē komats ir jāaptin ar figūriekavām {,}, lai novērstu automātisku atstarpi.
  NEPAREIZI: $3,14$ (LaTeX pievieno atstarpi aiz komata)
  PAREIZI: $3{,}14$ (nav atstarpes — pareizs decimālskaitlis)
  PAREIZI: $y \\in [1{,}5; 10{,}2]$ (diapazons ar decimālkomatiem)
  PAREIZI: $S = \\frac{5{,}5 \\cdot 3{,}2}{2}$ (laukuma formula)
</typography_and_math_rules>

<pedagogical_and_rag_rules>
1. SOKRĀTISKĀ METODE: Nekad nesniedz tiešu atbildi uz mājas darba vai eksāmena uzdevumiem. Vadi skolēnu ar mājieniem un analoģijām. Vienmēr beidz ar vienu vadošo jautājumu. Izņēmums: faktuāli jautājumi un gadījumi, kad skolēns tieši lūdz atbildi.

2. KONTEKSTA IZMANTOŠANA: Tev ir ATĻAUTS secināt, sintezēt un deducēt no sniegtajiem konteksta fragmentiem. Nav nepieciešama precīza atslēgvārdu sakritība — izmanto loģisku secinājumu, lai atrastu atbildi kontekstā. Faktuāliem jautājumiem, kas nav kontekstā, atbildi no vispārīgām zināšanām.

3. ANTI-ATTEIKUMS UN DOMĀŠANAS ĶĒDE: Pirms KATRAS atbildes ģenerēšanas atver <thinking> bloku un:
   (a) Skenē konteksta fragmentus — meklē atbilstošu informāciju.
   (b) Identificē relevantus datus — pat ja tie nav tieši saistīti ar jautājuma formulējumu.
   (c) Plāno Sokrātisko jautājumu (uzdevumiem) vai tiešu atbildi (faktiem).
   Šis bloks NAV redzams skolēnam.
   AIZLIEGTS rakstīt: „Šīs informācijas nav manā datubāzē", „Es nevaru palīdzēt", „Mans konteksts šo tēmu neaptver".
   Ja konteksts patiešām nepietiek — pārorientē sarunu uz tematiski saistītu Sokrātisku jautājumu.
</pedagogical_and_rag_rules>

<few_shot_examples>
PIEMĒRS 1 — Matemātika (trijstūra laukums):
Skolēns: „Kā aprēķināt trijstūra laukumu, ja pamats ir 5,5 cm un augstums 3,2 cm?"

<thinking>
Kontekstā ir informācija par trijstūra laukuma formulu: S = (a · h) / 2. Skolēns jautā par konkrētu uzdevumu — jāizmanto Sokrātiskā metode. Decimālskaitļi jāraksta ar {,} LaTeX iekšienē. Jālieto debitīvs un pro-drop.
</thinking>

Trijstūra laukumu aprēķina ar formulu: $S = \\frac{a \\cdot h}{2}$, kur $a$ ir pamats un $h$ ir augstums.

Šajā gadījumā tev ir jāievieto $a = 5{,}5$ cm un $h = 3{,}2$ cm formulā. Pamēģini — kādu skaitli iegūsi, reizinot $5{,}5 \\cdot 3{,}2$?

---

PIEMĒRS 2 — Vēsture (Pirmais pasaules karš):
Skolēns: „Kādi bija Pirmā pasaules kara cēloņi?"

<thinking>
Šis ir faktuāls jautājums — jāatbild tieši. Kontekstā ir informācija par PPK cēloņiem. Jālieto Vieglā valoda, „tu" forma, en-domuzīmes, latviešu pēdiņas.
</thinking>

Pirmajam pasaules karam bija vairāki cēloņi:

- **Militārās alianses** – Eiropa bija sadalīta divos blokos: „Antante" un „Centrālās valstis". Ja viena valsts nonāca karā – sabiedrotajiem bija jāpievienojas.
- **Nacionālisms** – daudzas tautas vēlējās neatkarību vai lielāku varu, īpaši Balkānos.
- **Imperiālisms** – lielvalstis sacensās par kolonijām un resursiem.
- **Tiešais iemesls** – Austroungārijas troņmantinieka Franca Ferdinanda slepkavība Sarajevā $1914{,}$ gadā aizsāka ķēdes reakciju.
</few_shot_examples>`;
}

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface RagInput {
  query: string;
  subject: string;
  grade: number;
  model?: "deepseek" | "claude";
  conversationHistory?: ChatMessage[];
}

export interface RagResult extends DeepSeekResponse {
  chunks: RetrievedChunk[];
}

// ---------------------------------------------------------------------------
// RAG chain (non-streaming)
// ---------------------------------------------------------------------------

function chunksFromTexts(texts: string[]): RetrievedChunk[] {
  return texts.map((text) => ({
    content: text,
    metadata: { source_pdf: "", subject: "", grade_min: 1, grade_max: 12, page_number: 0, chunk_index: 0, section_title: "" },
    distance: 0,
  }));
}

function formatContext(texts: string[], sources: string[]): string {
  return texts
    .map((t, i) => `[${i + 1}] ${sources[i] ?? "nezināms avots"}\n${t}`)
    .join("\n\n---\n\n");
}

function buildMessages(
  systemPrompt: string,
  context: string,
  query: string,
  conversationHistory: ChatMessage[],
): ChatMessage[] {
  // Anchor-turn pattern: context in a dedicated user turn acknowledged by
  // the assistant, so the model treats the chunks as "received" information.
  // Conversation history sits between the anchor and the current question.
  return [
    { role: "system", content: systemPrompt },
    { role: "user", content: `Šeit ir mācību materiālu fragmenti no Skola2030, uz kuriem balstīt atbildi:\n\n${context}` },
    { role: "assistant", content: "Sapratu. Atbildēšu balstoties uz šo informāciju." },
    ...conversationHistory,
    { role: "user", content: query },
  ];
}

export async function runRagChain(input: RagInput): Promise<RagResult> {
  const { query, subject, grade, model = "deepseek", conversationHistory = [] } = input;

  const { texts, sources } = await retrieveContext(query);
  const chunks = chunksFromTexts(texts);
  const context = formatContext(texts, sources);
  const messages = buildMessages(buildSystemPrompt(subject, grade), context, query, conversationHistory as ChatMessage[]);

  const response = await chat(messages, 0.3, model);
  return { ...response, chunks };
}

// ---------------------------------------------------------------------------
// RAG chain (streaming) — yields text deltas then a final metadata object
// ---------------------------------------------------------------------------

export type StreamEvent =
  | { type: "delta"; text: string }
  | { type: "done"; chunks: RetrievedChunk[]; usage: { prompt_tokens: number; completion_tokens: number; total_tokens: number } };

export async function* runRagChainStream(
  input: RagInput,
): AsyncGenerator<StreamEvent> {
  const { query, subject, grade, model = "deepseek", conversationHistory = [] } = input;

  const { texts, sources } = await retrieveContext(query);
  console.log("[RAG] retrieveContext result:", {
    chunkCount: texts.length,
    sources,
    firstChunkPreview: texts[0]?.slice(0, 200) ?? "(empty)",
  });

  const chunks = chunksFromTexts(texts);
  const context = formatContext(texts, sources);
  console.log("[RAG] formatted context length:", context.length, "chars");

  const messages = buildMessages(buildSystemPrompt(subject, grade), context, query, conversationHistory as ChatMessage[]);
  console.log("[RAG] messages sent to AI:", JSON.stringify(messages, null, 2));

  const { stream, getUsage } = chatStream(messages, 0.3, model);
  for await (const delta of stream) {
    yield { type: "delta", text: delta };
  }

  const usage = getUsage();
  yield {
    type: "done",
    chunks,
    usage,
  };
}
