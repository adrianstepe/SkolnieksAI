"use client";

import { useState } from "react";

export interface WebSource {
  title: string;
  url: string;
  snippet: string;
  favicon: string;
}

// ---------------------------------------------------------------------------
// SourcesBubble
// ---------------------------------------------------------------------------
// Mirrors ChatGPT's search UI: pill badge above answer, collapsible drawer
// with favicon + title + snippet + link for each source.
// ---------------------------------------------------------------------------

export function SourcesBubble({ sources }: { sources: WebSource[] }) {
  const [open, setOpen] = useState(false);

  if (sources.length === 0) return null;

  const visibleFavicons = sources.slice(0, 3);

  return (
    <div className="mt-3 space-y-2">
      {/* ── Top badge ─────────────────────────────────────────────── */}
      <div className="flex items-center gap-1.5">
        <span className="inline-flex items-center gap-1 rounded-full bg-blue-50 px-2.5 py-0.5 text-[11px] font-medium text-blue-600 border border-blue-200 dark:bg-blue-950/30 dark:text-blue-400 dark:border-blue-800">
          <svg viewBox="0 0 16 16" fill="none" className="h-3 w-3 shrink-0" aria-hidden="true">
            <circle cx="8" cy="8" r="6.5" stroke="currentColor" strokeWidth="1.25" />
            <path d="M8 1.5C8 1.5 5.5 4 5.5 8s2.5 6.5 2.5 6.5M8 1.5C8 1.5 10.5 4 10.5 8S8 14.5 8 14.5M1.5 8h13" stroke="currentColor" strokeWidth="1.25" strokeLinecap="round" />
          </svg>
          Meklēts internetā
        </span>
      </div>

      {/* ── Favicon stack + toggle pill ───────────────────────────── */}
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-2 rounded-lg border border-subtle bg-surface px-3 py-1.5 text-xs text-muted-custom hover:bg-surface-hover hover:text-primary-custom transition-colors"
        aria-expanded={open}
      >
        {/* Overlapping favicons */}
        <span className="flex items-center">
          {visibleFavicons.map((s, i) => (
            <img
              key={i}
              src={s.favicon}
              alt=""
              width={16}
              height={16}
              className="rounded-sm border border-subtle bg-white"
              style={{ marginLeft: i === 0 ? 0 : -5, zIndex: visibleFavicons.length - i }}
              onError={(e) => {
                (e.currentTarget as HTMLImageElement).style.display = "none";
              }}
            />
          ))}
        </span>

        <span className="font-medium">
          {sources.length} {sources.length === 1 ? "avots" : "avoti"}
        </span>

        {/* Chevron */}
        <svg
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 16 16"
          fill="currentColor"
          className={`h-3 w-3 transition-transform duration-200 ${open ? "rotate-180" : ""}`}
          aria-hidden="true"
        >
          <path
            fillRule="evenodd"
            d="M4.22 6.22a.75.75 0 0 1 1.06 0L8 8.94l2.72-2.72a.75.75 0 1 1 1.06 1.06l-3.25 3.25a.75.75 0 0 1-1.06 0L4.22 7.28a.75.75 0 0 1 0-1.06Z"
            clipRule="evenodd"
          />
        </svg>
      </button>

      {/* ── Expandable drawer ─────────────────────────────────────── */}
      <div
        className="overflow-hidden transition-all duration-300 ease-in-out"
        style={{ maxHeight: open ? `${sources.length * 120}px` : "0px" }}
      >
        <div className="space-y-2 pt-1">
          {sources.map((source, i) => (
            <SourceCard key={i} source={source} />
          ))}
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// SourceCard
// ---------------------------------------------------------------------------

function SourceCard({ source }: { source: WebSource }) {
  const hostname = (() => {
    try { return new URL(source.url).hostname; } catch { return source.url; }
  })();

  return (
    <a
      href={source.url || "#"}
      target="_blank"
      rel="noopener noreferrer"
      className="flex items-start gap-3 rounded-xl border border-subtle bg-base p-3 hover:bg-surface transition-colors group"
    >
      {/* Favicon */}
      <img
        src={source.favicon}
        alt=""
        width={28}
        height={28}
        className="rounded-md border border-subtle bg-white shrink-0 mt-0.5"
        onError={(e) => {
          (e.currentTarget as HTMLImageElement).style.display = "none";
        }}
      />

      {/* Text */}
      <div className="min-w-0 flex-1">
        <p className="text-[13px] font-semibold text-primary-custom truncate leading-snug">
          {source.title || hostname}
        </p>
        <p className="mt-0.5 text-[11px] text-muted-custom line-clamp-2 leading-relaxed">
          {source.snippet}
        </p>
        <p className="mt-1 text-[10px] text-muted-custom/70 truncate">{hostname}</p>
      </div>

      {/* Arrow */}
      <svg
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 16 16"
        fill="currentColor"
        className="h-3.5 w-3.5 shrink-0 text-muted-custom group-hover:text-primary transition-colors mt-0.5"
        aria-hidden="true"
      >
        <path
          fillRule="evenodd"
          d="M4.22 11.78a.75.75 0 0 1 0-1.06L9.44 5.5H5.75a.75.75 0 0 1 0-1.5h5.5a.75.75 0 0 1 .75.75v5.5a.75.75 0 0 1-1.5 0V6.56l-5.22 5.22a.75.75 0 0 1-1.06 0Z"
          clipRule="evenodd"
        />
      </svg>
    </a>
  );
}
