/**
 * scripts/ingest.ts
 *
 * Skola2030 PDF ingestion pipeline:
 *   PDF → extract text → clean → chunk → embed → ChromaDB
 *
 * Usage:
 *   npm run ingest                          # all PDFs in data/openstax/, data/wikipedia/
 *   npm run ingest -- --file path/to.pdf    # single file
 *   npm run ingest -- --reset               # drop collection first
 */

import fs from "fs";
import path from "path";
import pdfParse from "pdf-parse";
import { ChromaClient, Collection } from "chromadb";
import { embedBatch } from "../lib/ai/embeddings";
import { chunkText } from "../lib/utils/chunker";

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------

const CHROMA_URL = process.env.CHROMA_URL ?? "http://localhost:8000";
const COLLECTION_NAME = process.env.CHROMA_COLLECTION ?? "knowledge_chunks";
const DATA_DIRS = [
  path.resolve(process.cwd(), "data/openstax"),
  path.resolve(process.cwd(), "data/wikipedia"),
  // DISABLED: data/skola2030 — unlicensed; re-enable once a content license is obtained.
  // path.resolve(process.cwd(), "data/skola2030"),
];

// Batch size for ChromaDB upserts
const UPSERT_BATCH = 100;

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ChunkMetadata {
  source_pdf: string;
  subject: string;
  grade_min: number;
  grade_max: number;
  page_number: number;
  section_title: string;
}

// ---------------------------------------------------------------------------
// Subject + grade detection from filename
// ---------------------------------------------------------------------------

const SUBJECT_PATTERNS: Array<{ pattern: RegExp; subject: string }> = [
  { pattern: /matemat/i, subject: "math" },
  { pattern: /latvieu|latviesu/i, subject: "latvian" },
  { pattern: /angu|anglu/i, subject: "english" },
  { pattern: /dabaszin/i, subject: "science" },
  { pattern: /vestur/i, subject: "history" },
  { pattern: /social/i, subject: "social_studies" },
  { pattern: /fizik/i, subject: "physics" },
  { pattern: /kimij/i, subject: "chemistry" },
  { pattern: /biolog/i, subject: "biology" },
  { pattern: /informati/i, subject: "informatics" },
  { pattern: /sport/i, subject: "sports" },
  { pattern: /muzik/i, subject: "music" },
  { pattern: /maksla/i, subject: "arts" },
];

const GRADE_PATTERNS: Array<{ pattern: RegExp; min: number; max: number }> = [
  { pattern: /1[-_]3|pamatizglitiba_1/i, min: 1, max: 3 },
  { pattern: /4[-_]6/i, min: 4, max: 6 },
  { pattern: /7[-_]9/i, min: 7, max: 9 },
  { pattern: /10[-_]12/i, min: 10, max: 12 },
  { pattern: /pamatizglitiba/i, min: 1, max: 9 },
  { pattern: /vidusskola/i, min: 10, max: 12 },
];

function detectSubject(filename: string): string {
  for (const { pattern, subject } of SUBJECT_PATTERNS) {
    if (pattern.test(filename)) return subject;
  }
  return "general";
}

function detectGrades(filename: string): { min: number; max: number } {
  for (const { pattern, min, max } of GRADE_PATTERNS) {
    if (pattern.test(filename)) return { min, max };
  }
  return { min: 6, max: 12 }; // default: all target grades
}

// ---------------------------------------------------------------------------
// Text cleaning
// ---------------------------------------------------------------------------

function cleanText(raw: string): string {
  return raw
    // Remove page numbers (lone digits on a line)
    .replace(/^\s*\d{1,3}\s*$/gm, "")
    // Collapse repeated whitespace (but preserve paragraph breaks)
    .replace(/[ \t]+/g, " ")
    // Max 2 consecutive newlines
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

// ---------------------------------------------------------------------------
// Section title extraction (best-effort: short ALL-CAPS or numbered headings)
// ---------------------------------------------------------------------------

function extractSectionTitle(pageText: string): string {
  const lines = pageText.split("\n").map((l) => l.trim()).filter(Boolean);
  for (const line of lines.slice(0, 5)) {
    if (
      line.length < 100 &&
      (line === line.toUpperCase() || /^\d+(\.\d+)*\s+\S/.test(line))
    ) {
      return line;
    }
  }
  return "";
}

// ---------------------------------------------------------------------------
// ChromaDB helpers
// ---------------------------------------------------------------------------

async function getOrCreateCollection(
  client: ChromaClient,
  reset: boolean,
): Promise<Collection> {
  if (reset) {
    try {
      await client.deleteCollection({ name: COLLECTION_NAME });
      console.log(`Dropped existing collection "${COLLECTION_NAME}"`);
    } catch {
      // collection didn't exist — that's fine
    }
  }

  const collection = await client.getOrCreateCollection({
    name: COLLECTION_NAME,
    metadata: {
      description: "Knowledge base curriculum chunks",
      hnsw_space: "cosine",
    },
  });

  return collection;
}

async function upsertBatch(
  collection: Collection,
  ids: string[],
  embeddings: number[][],
  documents: string[],
  metadatas: ChunkMetadata[],
) {
  await collection.upsert({
    ids,
    embeddings,
    documents,
    metadatas: metadatas as unknown as Record<string, string | number | boolean>[],
  });
}

// ---------------------------------------------------------------------------
// Process a single PDF
// ---------------------------------------------------------------------------

async function processPdf(
  filePath: string,
  collection: Collection,
): Promise<number> {
  const filename = path.basename(filePath);
  const subject = detectSubject(filename);
  const { min: grade_min, max: grade_max } = detectGrades(filename);

  console.log(`\nProcessing: ${filename}`);
  console.log(`  Subject: ${subject}, Grades: ${grade_min}–${grade_max}`);

  const pdfBuffer = fs.readFileSync(filePath);
  const pdf = await pdfParse(pdfBuffer);

  // pdfParse gives us full text + page-level info via render_page callback
  // For simplicity we work at the full-text level, tagging chunks with
  // estimated page numbers based on character offsets.
  const fullText = cleanText(pdf.text);
  const charsPerPage = Math.ceil(fullText.length / Math.max(pdf.numpages, 1));

  // Use explicit chunking params for large texts (OpenStax) with min 15% overlap
  const rawChunks = chunkText(fullText, {
    targetTokens: 500,
    overlapTokens: 75,
    minChunkTokens: 100,
    separators: ["\n\n", "\n", ". ", " "],
  });
  console.log(`  Pages: ${pdf.numpages}, Raw chunks: ${rawChunks.length}`);

  // Accumulate batches
  const batchIds: string[] = [];
  const batchDocs: string[] = [];
  const batchMeta: ChunkMetadata[] = [];
  let totalUpserted = 0;

  for (let i = 0; i < rawChunks.length; i++) {
    const chunk = rawChunks[i];
    // Estimate page from character position in original text
    const charOffset = fullText.indexOf(chunk.slice(0, 40));
    const page_number =
      charOffset >= 0 ? Math.floor(charOffset / charsPerPage) + 1 : 1;

    const section_title = extractSectionTitle(chunk);
    const id = `${filename}::chunk::${i}`;

    batchIds.push(id);
    batchDocs.push(chunk);
    batchMeta.push({
      source_pdf: filename,
      subject,
      grade_min,
      grade_max,
      page_number,
      section_title,
    });

    if (batchIds.length === UPSERT_BATCH || i === rawChunks.length - 1) {
      process.stdout.write(
        `  Embedding + upserting chunks ${totalUpserted + 1}–${totalUpserted + batchIds.length}...`,
      );
      const embeddings = await embedBatch(batchDocs);
      await upsertBatch(collection, batchIds, embeddings, batchDocs, batchMeta);
      totalUpserted += batchIds.length;
      batchIds.length = 0;
      batchDocs.length = 0;
      batchMeta.length = 0;
      process.stdout.write(" done\n");
    }
  }

  console.log(`  Total upserted: ${totalUpserted} chunks`);
  return totalUpserted;
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  const args = process.argv.slice(2);
  const reset = args.includes("--reset");
  const fileIdx = args.indexOf("--file");
  const singleFile = fileIdx >= 0 ? args[fileIdx + 1] : null;

  const client = new ChromaClient({ path: CHROMA_URL });

  // Health check
  try {
    await client.heartbeat();
    console.log(`Connected to ChromaDB at ${CHROMA_URL}`);
  } catch {
    console.error(
      `ERROR: Cannot reach ChromaDB at ${CHROMA_URL}\n` +
        `Start it with: docker compose up -d`,
    );
    process.exit(1);
  }

  const collection = await getOrCreateCollection(client, reset);

  let pdfFiles: string[] = [];
  if (singleFile) {
    pdfFiles = [path.resolve(singleFile)];
  } else {
    for (const dir of DATA_DIRS) {
      if (fs.existsSync(dir)) {
        const files = fs.readdirSync(dir)
          .filter((f) => f.toLowerCase().endsWith(".pdf"))
          .map((f) => path.join(dir, f));
        pdfFiles.push(...files);
      }
    }
  }

  if (pdfFiles.length === 0) {
    console.warn(
      `No PDFs found in ${DATA_DIRS.join(", ")}.\n` +
        `Place OpenStax or Wikipedia PDFs there and re-run.`,
    );
    process.exit(0);
  }

  console.log(`Found ${pdfFiles.length} PDF(s) to ingest`);

  let total = 0;
  for (const filePath of pdfFiles) {
    total += await processPdf(filePath, collection);
  }

  const count = await collection.count();
  console.log(`\nIngestion complete. Collection "${COLLECTION_NAME}" now has ${count} chunks.`);
}

main().catch((err) => {
  console.error("Ingestion failed:", err);
  process.exit(1);
});
