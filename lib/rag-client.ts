/**
 * lib/rag-client.ts — RAG retrieval interface.
 *
 * Production (Vercel): queries Chroma Cloud directly via lib/rag/retriever.ts.
 * No Python server needed — embeddings run in Node.js via @xenova/transformers.
 *
 * Constants and types are defined in lib/rag/retriever.ts (canonical source)
 * and re-exported here so existing imports across the codebase keep working.
 */

import { retrieveFromCloud } from "@/lib/rag/retriever";

// Re-export constants and types from the canonical source
export {
  RAG_DISTANCE_THRESHOLD,
  KNOWN_CURRICULUM_SUBJECTS,
  type RetrieveResult,
} from "@/lib/rag/retriever";

/**
 * Query Chroma Cloud and return chunk texts + labelled sources.
 * Returns empty arrays if the retrieval fails — never throws.
 */
export async function retrieveContext(
  question: string,
  topK = 3,
  subject?: string,
) {
  return retrieveFromCloud(question, topK, subject);
}
