"use client";

import { useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkMath from "remark-math";
import rehypeKatex from "rehype-katex";

// ---------------------------------------------------------------------------
// Thinking block parser — handles both mid-stream and completed states
// ---------------------------------------------------------------------------

interface ParsedContent {
  thinking: string | null;
  answer: string;
  isThinking: boolean; // true = <thinking> opened but not yet closed (streaming)
}

function parseThinking(content: string): ParsedContent {
  const openIdx = content.indexOf("<thinking>");
  const closeIdx = content.indexOf("</thinking>");

  // Currently streaming inside a thinking block — open tag but no close tag yet
  if (openIdx !== -1 && closeIdx === -1) {
    return {
      thinking: content.slice(openIdx + "<thinking>".length).trim(),
      answer: content.slice(0, openIdx).trim(),
      isThinking: true,
    };
  }

  // Extract completed thinking blocks
  const thinkingParts: string[] = [];
  const regex = /<thinking>([\s\S]*?)<\/thinking>/g;
  let match: RegExpExecArray | null;
  while ((match = regex.exec(content)) !== null) {
    thinkingParts.push(match[1].trim());
  }

  const answer = content.replace(/<thinking>[\s\S]*?<\/thinking>\s*/g, "").trim();

  return {
    thinking: thinkingParts.length > 0 ? thinkingParts.join("\n\n") : null,
    answer,
    isThinking: false,
  };
}

// ---------------------------------------------------------------------------
// LaTeX normalizer — remark-math only understands $...$ and $$...$$
// ---------------------------------------------------------------------------

function normalizeLatex(content: string): string {
  return content
    .replace(/\\\[/g, "$$$$")
    .replace(/\\\]/g, "$$$$")
    .replace(/\\\(/g, "$")
    .replace(/\\\)/g, "$");
}

// ---------------------------------------------------------------------------
// Thinking block UI — collapsible like Claude / ChatGPT
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
        className="flex items-center gap-1.5 text-xs font-medium text-gray-400 hover:text-gray-500 dark:text-slate-500 dark:hover:text-slate-400 transition-colors"
      >
        {/* Sparkle icon */}
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
            {"Dom\u0101ju"}
            <span className="inline-flex w-5">
              <span className="animate-[ellipsis_1.5s_steps(3,end)_infinite]">...</span>
            </span>
          </span>
        ) : (
          <span>
            {"Dom\u0101\u0161anas process"}
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

      {/* Expanded thinking content */}
      {(isThinking || open) && thinking && (
        <div className="mt-2 rounded-lg border border-gray-100 bg-gray-50 px-3 py-2 text-xs leading-relaxed text-gray-500 dark:border-slate-700 dark:bg-slate-900/50 dark:text-slate-400">
          <div className="whitespace-pre-wrap">{thinking}</div>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Public types & components
// ---------------------------------------------------------------------------

export interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  sources?: Array<{
    id: string;
    subject: string;
    page: number;
    section: string;
  }>;
}

export function ChatMessage({ message }: { message: Message }) {
  const isUser = message.role === "user";
  const parsed = isUser ? null : parseThinking(message.content);

  return (
    <div
      className={`flex w-full ${isUser ? "justify-end" : "justify-start"}`}
    >
      <div
        className={`max-w-[85%] rounded-2xl px-4 py-3 text-[15px] leading-relaxed sm:max-w-[75%] ${
          isUser
            ? "bg-brand-600 text-white rounded-br-md"
            : "bg-white text-gray-800 shadow-sm border border-gray-100 rounded-bl-md dark:bg-slate-800 dark:text-slate-200 dark:border-slate-700"
        }`}
      >
        {isUser ? (
          <div className="whitespace-pre-wrap break-words">{message.content}</div>
        ) : (
          <>
            {/* Thinking block — shown during and after streaming */}
            {parsed && (parsed.isThinking || parsed.thinking) && (
              <ThinkingBlock
                thinking={parsed.thinking}
                isThinking={parsed.isThinking}
              />
            )}

            {/* Answer content */}
            {parsed && parsed.answer && (
              <div className="break-words [&_ul]:list-disc [&_ul]:pl-5 [&_ol]:list-decimal [&_ol]:pl-5 [&_strong]:font-semibold [&_p]:mb-2 [&_p:last-child]:mb-0">
                <ReactMarkdown
                  remarkPlugins={[remarkMath]}
                  rehypePlugins={[rehypeKatex]}
                >
                  {normalizeLatex(parsed.answer)}
                </ReactMarkdown>
              </div>
            )}
          </>
        )}

        {!isUser && message.sources && message.sources.length > 0 && (
          <div className="mt-3 border-t border-gray-100 pt-2 dark:border-slate-700">
            <p className="text-xs font-medium text-gray-400 mb-1 dark:text-slate-500">
              Avoti:
            </p>
            <div className="flex flex-wrap gap-1">
              {message.sources.map((source, i) => (
                <span
                  key={`${source.id}-${i}`}
                  className="inline-block rounded-full bg-brand-50 px-2 py-0.5 text-xs text-brand-700 dark:bg-slate-700 dark:text-brand-300"
                >
                  {source.section || source.subject} lpp. {source.page}
                </span>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export function TypingIndicator() {
  return (
    <div className="flex justify-start">
      <div className="rounded-2xl rounded-bl-md bg-white px-4 py-3 shadow-sm border border-gray-100 dark:bg-slate-800 dark:border-slate-700">
        <div className="flex items-center gap-1.5">
          <span className="h-2 w-2 rounded-full bg-gray-300 animate-bounce [animation-delay:0ms] dark:bg-slate-500" />
          <span className="h-2 w-2 rounded-full bg-gray-300 animate-bounce [animation-delay:150ms] dark:bg-slate-500" />
          <span className="h-2 w-2 rounded-full bg-gray-300 animate-bounce [animation-delay:300ms] dark:bg-slate-500" />
        </div>
      </div>
    </div>
  );
}
