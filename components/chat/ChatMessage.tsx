"use client";

import { useState, useEffect } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import remarkBreaks from "remark-breaks";
import remarkMath from "remark-math";
import rehypeKatex from "rehype-katex";
import rehypeHighlight from "rehype-highlight";
import { SourcesBubble } from "@/components/SourcesBubble";
import { useStreamingMarkdown } from "@/hooks/useStreamingMarkdown";
import { MathErrorBoundary } from "@/components/chat/MathErrorBoundary";
import { collection, addDoc, serverTimestamp } from "firebase/firestore";
import { db } from "@/lib/firebase/client";

// ---------------------------------------------------------------------------
// Thinking block parser
// ---------------------------------------------------------------------------

interface ParsedContent {
  thinking: string | null;
  answer: string;
  isThinking: boolean;
}

function parseThinking(content: string): ParsedContent {
  const openIdx = content.indexOf("<thinking>");
  const closeIdx = content.indexOf("</thinking>");

  if (openIdx !== -1 && closeIdx === -1) {
    return {
      thinking: content.slice(openIdx + "<thinking>".length).trim(),
      answer: content.slice(0, openIdx).trim(),
      isThinking: true,
    };
  }

  const thinkingParts: string[] = [];
  const regex = /<thinking>([\s\S]*?)<\/thinking>/g;
  let match: RegExpExecArray | null;
  while ((match = regex.exec(content)) !== null) {
    thinkingParts.push(match[1].trim());
  }

  const answer = content
    .replace(/<thinking>[\s\S]*?<\/thinking>\s*/g, "")
    .trim();

  return {
    thinking: thinkingParts.length > 0 ? thinkingParts.join("\n\n") : null,
    answer,
    isThinking: false,
  };
}

// ---------------------------------------------------------------------------
// LaTeX normalizer
// ---------------------------------------------------------------------------

function normalizeLatex(content: string): string {
  return content
    .replace(/\\\[/g, "$$$$")
    .replace(/\\\]/g, "$$$$")
    .replace(/\\\(/g, "$")
    .replace(/\\\)/g, "$");
}

// ---------------------------------------------------------------------------
// Thinking block UI
// ---------------------------------------------------------------------------

function ThinkingBlock({
  thinking,
  isThinking,
}: {
  thinking: string | null;
  isThinking: boolean;
}) {
  const [open, setOpen] = useState(false);

  return (
    <div className="mb-3">
      <button
        onClick={() => !isThinking && setOpen((o) => !o)}
        className="flex items-center gap-1.5 text-xs font-medium text-[#6B7280] dark:text-[#8B95A8] hover:text-[#111827] dark:hover:text-[#E8ECF4] transition-colors"
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 16 16"
          fill="currentColor"
          className={`h-3.5 w-3.5 ${isThinking ? "animate-spin" : ""}`}
        >
          <path
            fillRule="evenodd"
            d="M8 1a.75.75 0 0 1 .75.75v1.5a3.75 3.75 0 0 0 3 3 .75.75 0 0 1 0 1.5 3.75 3.75 0 0 0-3 3v1.5a.75.75 0 0 1-1.5 0v-1.5a3.75 3.75 0 0 0-3-3 .75.75 0 0 1 0-1.5 3.75 3.75 0 0 0 3-3v-1.5A.75.75 0 0 1 8 1Z"
            clipRule="evenodd"
          />
        </svg>

        {isThinking ? (
          <span className="italic">
            Domāju
            <span className="inline-flex w-5">
              <span className="animate-[ellipsis_1.5s_steps(3,end)_infinite]">
                ...
              </span>
            </span>
          </span>
        ) : (
          <span>
            Domāšanas process
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 16 16"
              fill="currentColor"
              className={`ml-0.5 inline h-3 w-3 transition-transform ${open ? "rotate-180" : ""}`}
            >
              <path
                fillRule="evenodd"
                d="M4.22 6.22a.75.75 0 0 1 1.06 0L8 8.94l2.72-2.72a.75.75 0 1 1 1.06 1.06l-3.25 3.25a.75.75 0 0 1-1.06 0L4.22 7.28a.75.75 0 0 1 0-1.06Z"
                clipRule="evenodd"
              />
            </svg>
          </span>
        )}
      </button>

      {(isThinking || open) && thinking && (
        <div className="mt-2 rounded-lg border border-[#E5E7EB] dark:border-white/7 bg-[#F9FAFB] dark:bg-[#1A2033] px-3 py-2 text-xs leading-relaxed text-[#6B7280] dark:text-[#8B95A8]">
          <div className="whitespace-pre-wrap">{thinking}</div>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Streaming-safe markdown renderer
// ---------------------------------------------------------------------------

/**
 * Renders the assistant answer through react-markdown + KaTeX, but first
 * passes the content through two safety layers:
 *
 * 1. `useStreamingMarkdown` — holds back any content from the last unclosed
 *    `$` or `$$` delimiter so KaTeX never receives a partial math expression.
 * 2. `MathErrorBoundary` — catches any KaTeX parse errors that slip through
 *    (e.g. LLM hallucinated invalid LaTeX) and renders the raw string in a
 *    <code> block instead of crashing the message bubble.
 */
function AssistantMessageContent({ answer }: { answer: string }) {
  const normalized = normalizeLatex(answer);
  const { safeContent } = useStreamingMarkdown(normalized);

  return (
    <MathErrorBoundary rawContent={safeContent}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm, remarkBreaks, remarkMath]}
        rehypePlugins={[rehypeKatex, rehypeHighlight]}
      >
        {safeContent}
      </ReactMarkdown>
    </MathErrorBoundary>
  );
}

// ---------------------------------------------------------------------------
// Public types & components
// ---------------------------------------------------------------------------

export interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  /** RAG chunks (Path A) */
  sources?: Array<{
    id: string;
    subject: string;
    page: number;
    section: string;
    sourceType?: string;
    sourceTitle?: string;
  }>;
  /** Web search results (Path B) */
  webSources?: Array<{
    title: string;
    url: string;
    snippet: string;
    favicon: string;
  }>;
  usedWebSearch?: boolean;
}

// ---------------------------------------------------------------------------
// Subject → CSS variable color mapping
// ---------------------------------------------------------------------------

const SUBJECT_COLOR_MAP: Record<string, string> = {
  math: "var(--color-subj-math)",
  chemistry: "var(--color-subj-chemistry)",
  latvian: "var(--color-subj-latvian)",
  history: "var(--color-subj-history)",
  physics: "var(--color-subj-physics)",
  english: "var(--color-subj-english)",
  science: "var(--color-subj-science)",
  social: "var(--color-subj-social)",
  biology: "var(--color-subj-biology)",
  informatics: "var(--color-subj-informatics)",
  geography: "var(--color-subj-geography)",
  art: "var(--color-subj-art)",
};

function getSubjectColor(subject?: string): string {
  if (!subject) return "var(--color-primary)";
  return SUBJECT_COLOR_MAP[subject] ?? "var(--color-primary)";
}

// ---------------------------------------------------------------------------
// Thumbs up/down feedback
// ---------------------------------------------------------------------------

function MessageFeedback({
  messageId,
  conversationId,
  userId,
}: {
  messageId: string;
  conversationId: string | null;
  userId: string | null;
}) {
  const [rating, setRating] = useState<1 | -1 | null>(null);
  const [saving, setSaving] = useState(false);

  async function handleRate(value: 1 | -1) {
    if (saving || rating === value) return;
    setSaving(true);
    try {
      await addDoc(collection(db, "message_feedback"), {
        messageId,
        conversationId: conversationId ?? null,
        userId: userId ?? null,
        rating: value,
        timestamp: serverTimestamp(),
      });
      setRating(value);
    } catch {
      // silent — feedback is non-critical
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="flex items-center gap-1 px-1">
      <button
        onClick={() => handleRate(1)}
        disabled={saving}
        aria-label="Novērtēt pozitīvi"
        className={`p-1 rounded-md transition-colors ${
          rating === 1
            ? "text-[#22C55E]"
            : "text-[#9CA3AF] dark:text-[#4B5563] hover:text-[#22C55E]"
        }`}
      >
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-3.5 h-3.5">
          <path d="M1 8.25a1.25 1.25 0 1 1 2.5 0v7.5a1.25 1.25 0 1 1-2.5 0v-7.5ZM5.5 6.802v7.948a2.56 2.56 0 0 0 1.169 2.15 1.35 1.35 0 0 0 1.598-.099l.78-.624a4.25 4.25 0 0 1 2.655-.933h1.548a2.58 2.58 0 0 0 2.45-1.75l1.2-3.59a1.75 1.75 0 0 0-1.66-2.304H12.5V4.25A2.25 2.25 0 0 0 10.25 2c-.39 0-.75.25-.88.63L7.08 8.998A2.573 2.573 0 0 1 5.5 6.802Z" />
        </svg>
      </button>
      <button
        onClick={() => handleRate(-1)}
        disabled={saving}
        aria-label="Novērtēt negatīvi"
        className={`p-1 rounded-md transition-colors ${
          rating === -1
            ? "text-[#EF4444]"
            : "text-[#9CA3AF] dark:text-[#4B5563] hover:text-[#EF4444]"
        }`}
      >
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-3.5 h-3.5">
          <path d="M19 11.75a1.25 1.25 0 1 1-2.5 0v-7.5a1.25 1.25 0 1 1 2.5 0v7.5ZM14.5 13.198V5.25a2.56 2.56 0 0 0-1.169-2.15 1.35 1.35 0 0 0-1.598.099l-.78.624a4.25 4.25 0 0 1-2.655.933H6.75a2.58 2.58 0 0 0-2.45 1.75l-1.2 3.59a1.75 1.75 0 0 0 1.66 2.304H7.5v3.45A2.25 2.25 0 0 0 9.75 18c.39 0 .75-.25.88-.63l2.29-6.368a2.573 2.573 0 0 1 1.58 2.196Z" />
        </svg>
      </button>
    </div>
  );
}

export function ChatMessage({
  message,
  subject,
  conversationId,
  userId,
}: {
  message: Message;
  subject?: string;
  conversationId?: string | null;
  userId?: string | null;
}) {
  const isUser = message.role === "user";
  const parsed = isUser ? null : parseThinking(message.content);
  const accentColor = getSubjectColor(subject);

  return (
    <div
      className={`flex gap-2.5 sm:gap-3 ${isUser ? "justify-end animate-slide-in-right" : "justify-start animate-slide-in-left"}`}
    >
      {/* AI avatar */}
      {!isUser && (
        <div
          className="w-7 h-7 sm:w-8 sm:h-8 rounded-lg bg-gradient-to-br from-[#2563EB] to-[#1D4ED8] shadow-sm shadow-[#2563EB]/30 flex items-center justify-center shrink-0 mt-1"
        >
          <svg viewBox="0 0 24 24" fill="none" className="h-3.5 w-3.5 sm:h-4 sm:w-4">
            <path
              d="M12 2L14.5 9.5L22 12L14.5 14.5L12 22L9.5 14.5L2 12L9.5 9.5L12 2Z"
              fill="white"
            />
          </svg>
        </div>
      )}

      <div
        className={`max-w-[80%] sm:max-w-[75%] space-y-1.5 sm:space-y-2 ${isUser ? "order-first" : ""}`}
      >
        <div
          className={`rounded-2xl px-3.5 py-2.5 sm:px-4 sm:py-3 text-sm leading-relaxed ${
            isUser
              ? "bg-[#2563EB] dark:bg-[#4F8EF7] text-white rounded-br-sm shadow-sm"
              : "bg-[#F1F5F9] dark:bg-[#1A2033] text-[#111827] dark:text-[#E8ECF4] rounded-bl-sm border-l-2"
          }`}
          style={
            !isUser ? { borderLeftColor: accentColor } : undefined
          }
        >
          {isUser ? (
            <p className="whitespace-pre-wrap break-words">
              {message.content}
            </p>
          ) : (
            <>
              {parsed && (parsed.isThinking || parsed.thinking) && (
                <ThinkingBlock
                  thinking={parsed.thinking}
                  isThinking={parsed.isThinking}
                />
              )}

              {parsed && parsed.answer && (
                <>
                  <div className="markdown-prose break-words [&_ul]:list-disc [&_ul]:pl-5 [&_ol]:list-decimal [&_ol]:pl-5 [&_strong]:font-semibold [&_p]:mb-2 [&_p:last-child]:mb-0 [&_code]:font-mono [&_code]:text-sm [&_code]:bg-[#F9FAFB] dark:[&_code]:bg-[#0F1117] [&_code]:px-1 [&_code]:py-0.5 [&_code]:rounded [&_h1]:text-lg [&_h1]:font-semibold [&_h1]:mt-4 [&_h1]:mb-2 [&_h2]:text-base [&_h2]:font-semibold [&_h2]:mt-3 [&_h2]:mb-1.5 [&_h3]:text-sm [&_h3]:font-semibold [&_h3]:mt-2.5 [&_h3]:mb-1 [&_h1:first-child]:mt-0 [&_h2:first-child]:mt-0 [&_h3:first-child]:mt-0 [&_blockquote]:border-l-2 [&_blockquote]:border-[#4F8EF7] [&_blockquote]:pl-3 [&_blockquote]:my-2 [&_blockquote]:text-[#6B7280] dark:[&_blockquote]:text-[#8B95A8] [&_blockquote]:italic [&_hr]:my-3 [&_hr]:border-[#E5E7EB] dark:[&_hr]:border-white/10 prose-table:w-full">
                    <AssistantMessageContent answer={parsed.answer} />
                  </div>

                  {/* Web sources bubble — shown for Path B answers */}
                  {message.webSources && message.webSources.length > 0 && (
                    <SourcesBubble sources={message.webSources} />
                  )}
                </>
              )}
            </>
          )}
        </div>

        {/* EU AI Act label + feedback row */}
        {!isUser && (
          <div className="flex items-center gap-2 px-1">
            <p
              className="text-[10px] text-[#9CA3AF] dark:text-[#4B5563]"
              title="Šī atbilde ir ģenerēta ar mākslīgo intelektu"
            >
              AI ģenerēta atbilde
            </p>
            <MessageFeedback
              messageId={message.id}
              conversationId={conversationId ?? null}
              userId={userId ?? null}
            />
          </div>
        )}

      </div>
    </div>
  );
}

export function TypingIndicator({ subject }: { subject?: string }) {
  const [phase, setPhase] = useState<1 | 2>(1);
  const accentColor = getSubjectColor(subject);

  useEffect(() => {
    const timer = setTimeout(() => setPhase(2), 1500);
    return () => clearTimeout(timer);
  }, []);

  const shimmerBars = [
    { width: "w-48", delay: "0s" },
    { width: "w-36", delay: "0.15s" },
    { width: "w-28", delay: "0.30s" },
  ] as const;

  return (
    <div className="flex gap-2.5 sm:gap-3 animate-slide-in-left">
      {/* AI avatar */}
      <div
        className="w-7 h-7 sm:w-8 sm:h-8 rounded-lg bg-gradient-to-br from-[#2563EB] to-[#1D4ED8] shadow-sm shadow-[#2563EB]/30 flex items-center justify-center shrink-0 mt-1"
      >
        <svg viewBox="0 0 24 24" fill="none" className="h-3.5 w-3.5 sm:h-4 sm:w-4">
          <path
            d="M12 2L14.5 9.5L22 12L14.5 14.5L12 22L9.5 14.5L2 12L9.5 9.5L12 2Z"
            fill="white"
          />
        </svg>
      </div>

      <div
        className="bg-[#F1F5F9] dark:bg-[#1A2033] rounded-2xl rounded-bl-md px-4 py-3 border-l-2"
        style={{ borderLeftColor: accentColor }}
      >
        {phase === 1 ? (
          /* Phase 1 — spinning arc + "Domāju..." text */
          <div className="flex items-center gap-1.5 animate-fade-in">
            <svg
              width="14"
              height="14"
              viewBox="0 0 14 14"
              fill="none"
              className="animate-spin shrink-0"
              aria-hidden="true"
            >
              <circle
                cx="7"
                cy="7"
                r="5.5"
                stroke="#6B7280"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeDasharray="26"
                strokeDashoffset="8"
              />
            </svg>
            <span className="text-xs text-[#6B7280] dark:text-[#8B95A8] italic">
              Domāju...
            </span>
          </div>
        ) : (
          /* Phase 2 — shimmer bars */
          <div className="flex flex-col gap-1.5 animate-fade-in">
            {shimmerBars.map(({ width, delay }, i) => (
              <div
                key={i}
                className={`${width} h-2.5 rounded-full bg-[#2563EB]/20 dark:bg-[#4F8EF7]/15 shimmer-bar`}
                style={{ animationDelay: delay }}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
