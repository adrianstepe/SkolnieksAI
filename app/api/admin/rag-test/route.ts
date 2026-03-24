/**
 * POST /api/admin/rag-test
 *
 * Admin-only RAG test harness. Given a query, this endpoint runs the full
 * retrieval pipeline and returns a detailed trace for the admin dashboard:
 *   - retrieved chunks + distances + sources
 *   - whether RAG or web search was used
 *   - the final one-shot AI response
 *
 * Body: { query: string; topK?: number }
 */

import { NextRequest, NextResponse } from "next/server";
import { retrieveContext, RAG_DISTANCE_THRESHOLD } from "@/lib/rag-client";
import { webSearch, type WebSearchResult } from "@/lib/search/web";
import { chat, type ChatMessage } from "@/lib/ai/deepseek";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export type SourceType = "rag" | "web" | "none";

export interface RagTestChunk {
  text: string;
  source: string;
  distance: number | null;
  confident: boolean;
}

export interface RagTestResult {
  query: string;
  sourceType: SourceType;
  hasConfidentMatch: boolean;
  chunks: RagTestChunk[];
  webResults: WebSearchResult[];
  aiResponse: string;
  usage: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
  durationMs: number;
}

export async function POST(req: NextRequest) {
  const start = Date.now();

  let body: { query?: unknown; topK?: unknown };
  try {
    body = (await req.json()) as { query?: unknown; topK?: unknown };
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const query = typeof body.query === "string" ? body.query.trim() : "";
  if (!query) {
    return NextResponse.json(
      { error: "`query` is required and must be a non-empty string" },
      { status: 400 },
    );
  }

  const topK =
    typeof body.topK === "number" && body.topK > 0 && body.topK <= 10
      ? body.topK
      : 3;

  // ── Step 1: RAG retrieval ─────────────────────────────────────────────────
  const ragResult = await retrieveContext(query, topK);

  const chunks: RagTestChunk[] = ragResult.texts.map((text, i) => ({
    text,
    source: ragResult.sources[i] ?? "unknown",
    distance: ragResult.distances[i] ?? null,
    confident:
      ragResult.distances[i] !== undefined
        ? ragResult.distances[i] < RAG_DISTANCE_THRESHOLD
        : true, // no distance → assume confident
  }));

  // ── Step 2: Decide source path ────────────────────────────────────────────
  let sourceType: SourceType = "none";
  let webResults: WebSearchResult[] = [];
  let contextText = "";

  if (ragResult.hasConfidentMatch) {
    sourceType = "rag";
    contextText = ragResult.texts
      .map((t, i) => `[${ragResult.sources[i] ?? `Chunk ${i + 1}`}]\n${t}`)
      .join("\n\n---\n\n");
  } else {
    // Fall back to web search
    webResults = await webSearch(query, 3);
    if (webResults.length > 0) {
      sourceType = "web";
      contextText = webResults
        .map((r) => `[${r.title}] (${r.url})\n${r.snippet}`)
        .join("\n\n---\n\n");
    }
    // else sourceType stays "none"
  }

  // ── Step 3: One-shot AI completion ────────────────────────────────────────
  const messages: ChatMessage[] = [
    {
      role: "system",
      content:
        contextText.length > 0
          ? `You are SkolnieksAI, an AI assistant for Latvian students. Answer the question below using ONLY the provided context. If the context is insufficient, say so clearly.\n\n## Context\n\n${contextText}`
          : "You are SkolnieksAI, an AI assistant for Latvian students. No relevant context was found for this query. Politely explain that you couldn't find relevant information.",
    },
    { role: "user", content: query },
  ];

  const aiResult = await chat(messages, 0.3, "deepseek", 600);

  const result: RagTestResult = {
    query,
    sourceType,
    hasConfidentMatch: ragResult.hasConfidentMatch,
    chunks,
    webResults,
    aiResponse: aiResult.content,
    usage: aiResult.usage,
    durationMs: Date.now() - start,
  };

  return NextResponse.json(result);
}
