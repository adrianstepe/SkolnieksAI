/**
 * components/admin/RagTestPanel.tsx
 *
 * Self-contained client component for the RAG test harness.
 * Fires POST /api/admin/rag-test and renders the full trace:
 *   - Source type badge (RAG / Web / None)
 *   - Retrieved chunks with distance scores
 *   - Web search results (if fallback was used)
 *   - Final AI response
 */

"use client";

import { useState } from "react";
import {
  FlaskConical,
  Globe,
  Database,
  AlertCircle,
  ChevronDown,
  ChevronRight,
  Loader2,
  Send,
  Clock,
  Zap,
} from "lucide-react";
import type { RagTestResult } from "@/app/api/admin/rag-test/route";

// ─── Source badge ─────────────────────────────────────────────────────────────

function SourceBadge({ type }: { type: RagTestResult["sourceType"] }) {
  const variants = {
    rag: {
      label: "RAG Knowledge Base",
      icon: Database,
      classes: "bg-success/10 border-success/25 text-success",
    },
    web: {
      label: "Web Search Fallback",
      icon: Globe,
      classes: "bg-warning/10 border-warning/25 text-warning",
    },
    none: {
      label: "No Context Found",
      icon: AlertCircle,
      classes: "bg-red-500/10 border-red-500/25 text-red-400",
    },
  };

  const { label, icon: Icon, classes } = variants[type];
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-semibold ${classes}`}
    >
      <Icon className="h-3.5 w-3.5" />
      {label}
    </span>
  );
}

// ─── Chunk card ───────────────────────────────────────────────────────────────

function ChunkCard({
  chunk,
  index,
}: {
  chunk: RagTestResult["chunks"][number];
  index: number;
}) {
  const [open, setOpen] = useState(false);

  const distColor =
    chunk.distance === null
      ? "text-text-muted"
      : chunk.confident
        ? "text-success"
        : "text-warning";

  return (
    <div className="rounded-xl border border-border bg-surface/40 overflow-hidden">
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center justify-between px-4 py-3 text-left hover:bg-surface-hover transition"
      >
        <div className="flex items-center gap-3 min-w-0">
          {open ? (
            <ChevronDown className="h-4 w-4 shrink-0 text-text-muted" />
          ) : (
            <ChevronRight className="h-4 w-4 shrink-0 text-text-muted" />
          )}
          <span className="text-xs font-semibold text-text-muted shrink-0">
            #{index + 1}
          </span>
          <span className="truncate text-sm text-text-secondary">
            {chunk.source}
          </span>
        </div>
        <div className="flex items-center gap-3 shrink-0 ml-3">
          {chunk.distance !== null && (
            <span className={`text-xs font-mono font-semibold ${distColor}`}>
              dist {chunk.distance.toFixed(3)}
            </span>
          )}
          <span
            className={`text-[10px] rounded-full px-2 py-0.5 border font-semibold ${
              chunk.confident
                ? "bg-success/10 border-success/25 text-success"
                : "bg-warning/10 border-warning/25 text-warning"
            }`}
          >
            {chunk.confident ? "confident" : "low confidence"}
          </span>
        </div>
      </button>
      {open && (
        <div className="border-t border-border px-4 py-3">
          <p className="text-sm text-text-secondary leading-relaxed whitespace-pre-wrap font-mono text-xs">
            {chunk.text}
          </p>
        </div>
      )}
    </div>
  );
}

// ─── Main panel ──────────────────────────────────────────────────────────────

export default function RagTestPanel() {
  const [query, setQuery] = useState("");
  const [topK, setTopK] = useState(3);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<RagTestResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function runTest() {
    if (!query.trim() || loading) return;
    setLoading(true);
    setResult(null);
    setError(null);

    try {
      const res = await fetch("/api/admin/rag-test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query: query.trim(), topK }),
      });

      if (!res.ok) {
        const text = await res.text();
        throw new Error(`HTTP ${res.status}: ${text}`);
      }

      const data = (await res.json()) as RagTestResult;
      setResult(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setLoading(false);
    }
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
      e.preventDefault();
      void runTest();
    }
  }

  return (
    <div className="space-y-6 max-w-4xl animate-fade-up">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-text-primary flex items-center gap-2">
          <FlaskConical className="h-6 w-6 text-accent" />
          RAG Test Harness
        </h1>
        <p className="mt-1 text-sm text-text-muted">
          Submit a query to inspect the full retrieval pipeline — chunks,
          distances, source decision, and AI response.
        </p>
      </div>

      {/* Query input */}
      <div className="rounded-2xl border border-border bg-surface/60 p-5 space-y-4">
        <textarea
          id="rag-query-input"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Enter a test query… (Ctrl+Enter to run)"
          rows={3}
          className="w-full resize-none rounded-xl border border-border bg-input-bg px-4 py-3 text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:ring-1 focus:ring-accent/50 transition"
        />

        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <label className="text-xs text-text-muted shrink-0">
              Top-K chunks
            </label>
            <select
              id="rag-topk-select"
              value={topK}
              onChange={(e) => setTopK(Number(e.target.value))}
              className="rounded-lg border border-border bg-input-bg px-2 py-1 text-sm text-text-primary focus:outline-none focus:ring-1 focus:ring-accent/50"
            >
              {[1, 2, 3, 5, 8, 10].map((n) => (
                <option key={n} value={n}>
                  {n}
                </option>
              ))}
            </select>
          </div>

          <button
            id="rag-run-btn"
            onClick={runTest}
            disabled={!query.trim() || loading}
            className="flex items-center gap-2 rounded-xl bg-accent px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-accent-hover disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Send className="h-4 w-4" />
            )}
            {loading ? "Running…" : "Run Test"}
          </button>
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="rounded-2xl border border-red-500/25 bg-red-500/5 px-5 py-4 text-sm text-red-400 flex items-start gap-3">
          <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Results */}
      {result && (
        <div className="space-y-5 animate-fade-up">
          {/* Meta row */}
          <div className="flex flex-wrap items-center gap-3">
            <SourceBadge type={result.sourceType} />
            <span className="flex items-center gap-1 text-xs text-text-muted">
              <Clock className="h-3.5 w-3.5" />
              {result.durationMs}ms
            </span>
            <span className="flex items-center gap-1 text-xs text-text-muted">
              <Zap className="h-3.5 w-3.5" />
              {result.usage.total_tokens} tokens
            </span>
          </div>

          {/* Query echo */}
          <div className="rounded-2xl border border-border bg-surface/40 p-5">
            <p className="mb-1.5 text-xs font-semibold uppercase tracking-wider text-text-muted">
              Query
            </p>
            <p className="text-sm text-text-primary">{result.query}</p>
          </div>

          {/* Chunks */}
          <div>
            <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-text-muted">
              Retrieved Chunks ({result.chunks.length})
            </p>
            {result.chunks.length === 0 ? (
              <div className="rounded-xl border border-border bg-surface/30 px-4 py-3 text-sm text-text-muted">
                No chunks retrieved.
              </div>
            ) : (
              <div className="space-y-2">
                {result.chunks.map((chunk, i) => (
                  <ChunkCard key={i} chunk={chunk} index={i} />
                ))}
              </div>
            )}
          </div>

          {/* Web results (only shown if web fallback) */}
          {result.sourceType === "web" && result.webResults.length > 0 && (
            <div>
              <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-text-muted">
                Web Search Results ({result.webResults.length})
              </p>
              <div className="space-y-2">
                {result.webResults.map((wr, i) => (
                  <div
                    key={i}
                    className="rounded-xl border border-border bg-surface/40 px-4 py-3"
                  >
                    <div className="flex items-center gap-2 mb-1">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={wr.favicon}
                        alt=""
                        width={14}
                        height={14}
                        className="rounded-sm"
                      />
                      <a
                        href={wr.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-xs font-semibold text-primary hover:underline truncate"
                      >
                        {wr.title}
                      </a>
                    </div>
                    <p className="text-xs text-text-secondary">{wr.snippet}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* AI response */}
          <div className="rounded-2xl border border-accent/20 bg-accent/5 p-5">
            <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-accent/70">
              AI Response
            </p>
            <p className="text-sm text-text-primary leading-relaxed whitespace-pre-wrap">
              {result.aiResponse}
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
