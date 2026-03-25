"use client";

import { useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkMath from "remark-math";
import rehypeKatex from "rehype-katex";
import { SourcesBubble } from "@/components/SourcesBubble";

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

export function ChatMessage({ message }: { message: Message }) {
  const isUser = message.role === "user";
  const parsed = isUser ? null : parseThinking(message.content);

  return (
    <div
      className={`flex gap-3 ${isUser ? "justify-end animate-slide-in-right" : "justify-start animate-slide-in-left"}`}
    >
      {/* AI avatar — gradient sparkle */}
      {!isUser && (
        <div className="w-8 h-8 rounded-lg gradient-primary flex items-center justify-center shrink-0 mt-1">
          <svg viewBox="0 0 24 24" fill="none" className="h-4 w-4">
            <path
              d="M12 2L14.5 9.5L22 12L14.5 14.5L12 22L9.5 14.5L2 12L9.5 9.5L12 2Z"
              fill="white"
            />
          </svg>
        </div>
      )}

      <div className={`max-w-[75%] space-y-2 ${isUser ? "order-first" : ""}`}>
        <div
          className={`rounded-2xl px-4 py-3 text-sm leading-relaxed ${
            isUser
              ? "bg-[#2563EB] dark:bg-[#4F8EF7] text-white rounded-br-md"
              : "bg-[#F1F5F9] dark:bg-[#1A2033] text-[#111827] dark:text-[#E8ECF4] rounded-bl-md"
          }`}
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
                  <div className="break-words [&_ul]:list-disc [&_ul]:pl-5 [&_ol]:list-decimal [&_ol]:pl-5 [&_strong]:font-semibold [&_p]:mb-2 [&_p:last-child]:mb-0 [&_code]:font-mono [&_code]:text-sm [&_code]:bg-[#F9FAFB] dark:[&_code]:bg-[#0F1117] [&_code]:px-1 [&_code]:py-0.5 [&_code]:rounded">
                    <ReactMarkdown
                      remarkPlugins={[remarkMath]}
                      rehypePlugins={[rehypeKatex]}
                    >
                      {normalizeLatex(parsed.answer)}
                    </ReactMarkdown>
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

        {/* Source citation — design studio style */}
        {!isUser && message.sources && message.sources.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {message.sources.map((source, i) => (
              <div
                key={`${source.id}-${i}`}
                className="flex items-start gap-2 px-3 py-2 rounded-lg bg-[#F1F5F9] dark:bg-[#1A2033]/30 border border-[#E5E7EB] dark:border-white/7"
              >
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-3.5 h-3.5 text-[#2563EB] dark:text-[#4F8EF7] mt-0.5 shrink-0">
                  <path d="M10.75 16.82A7.462 7.462 0 0 1 15 15.5c.71 0 1.396.098 2.046.282A.75.75 0 0 0 18 15.06V3.44a.75.75 0 0 0-.525-.72A8.963 8.963 0 0 0 15 2.25a8.963 8.963 0 0 0-4.25 1.063v13.507ZM9.25 4.313A8.963 8.963 0 0 0 5 2.25c-.862 0-1.7.121-2.475.345a.75.75 0 0 0-.525.72v11.62a.75.75 0 0 0 .954.721A7.506 7.506 0 0 1 5 15.5c1.579 0 3.042.487 4.25 1.32V4.313Z" />
                </svg>
                <div className="min-w-0">
                  <p className="text-[11px] font-medium text-[#2563EB] dark:text-[#4F8EF7]">
                    {source.subject}
                    {source.sourceTitle ? ` — ${source.sourceTitle}` : source.section ? ` — ${source.section}` : ""}
                  </p>
                  <p className="text-[10px] text-[#6B7280] dark:text-[#8B95A8] mt-0.5">
                    {source.sourceType === "openstax" ? "OpenStax CC BY 4.0"
                      : source.sourceType === "wikipedia_lv" ? "Wikipedia LV CC BY-SA 4.0"
                      : "Skola2030"}
                    {source.page > 0 ? ` · lpp. ${source.page}` : ""}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export function TypingIndicator() {
  return (
    <div className="flex gap-3 animate-slide-in-left">
      {/* AI avatar */}
      <div className="w-8 h-8 rounded-lg gradient-primary flex items-center justify-center shrink-0">
        <svg viewBox="0 0 24 24" fill="none" className="h-4 w-4">
          <path
            d="M12 2L14.5 9.5L22 12L14.5 14.5L12 22L9.5 14.5L2 12L9.5 9.5L12 2Z"
            fill="white"
          />
        </svg>
      </div>
      <div className="bg-[#F1F5F9] dark:bg-[#1A2033] rounded-2xl rounded-bl-md px-4 py-3 flex items-center gap-1.5">
        {[0, 1, 2].map((i) => (
          <div
            key={i}
            className="w-2 h-2 rounded-full bg-[#2563EB]/60 dark:bg-[#4F8EF7]/60 animate-typing-dot"
            style={{ animationDelay: `${i * 0.2}s` }}
          />
        ))}
      </div>
    </div>
  );
}
