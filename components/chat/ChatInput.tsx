"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import { useSettings } from "@/lib/context/settings-context";
import { useAuth } from "@/lib/context/auth-context";

const CHAR_LIMIT: Record<string, number> = {
  free: 4000,
  pro: 12000,
  premium: 32000,
  school_pro: 32000,
};

interface ChatInputProps {
  onSend: (message: string) => void;
  disabled?: boolean;
  isGenerating?: boolean;
  onStop?: () => void;
  pendingPrompt?: string;
  onPromptConsumed?: () => void;
  floating?: boolean;
}

export function ChatInput({
  onSend,
  disabled,
  isGenerating,
  onStop,
  pendingPrompt,
  onPromptConsumed,
  floating = false,
}: ChatInputProps) {
  const { settings } = useSettings();
  const { profile } = useAuth();
  const charLimit = CHAR_LIMIT[profile?.tier ?? "free"];
  const [value, setValue] = useState("");
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [showCameraHint, setShowCameraHint] = useState(false);

  useEffect(() => {
    if (typeof window !== "undefined") {
      setShowCameraHint(!localStorage.getItem("hasSeenCameraHint"));
    }
  }, []);

  // Populate textarea when a starter prompt card is tapped
  useEffect(() => {
    if (!pendingPrompt) return;
    setValue(pendingPrompt);
    onPromptConsumed?.();
    // Resize textarea then focus
    requestAnimationFrame(() => {
      const textarea = textareaRef.current;
      if (textarea) {
        textarea.style.height = "auto";
        textarea.style.height = `${Math.min(textarea.scrollHeight, 200)}px`;
        textarea.focus();
      }
    });
  }, [pendingPrompt, onPromptConsumed]);

  const handleSubmit = useCallback(() => {
    const trimmed = value.trim();
    if (!trimmed || disabled) return;
    onSend(trimmed);
    setValue("");
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
    }
    // Dismiss camera coach mark on first message sent
    if (showCameraHint) {
      localStorage.setItem("hasSeenCameraHint", "true");
      setShowCameraHint(false);
    }
  }, [value, disabled, onSend, showCameraHint]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey && settings.sendOnEnter) {
      e.preventDefault();
      handleSubmit();
    }
  };

  const handleInput = () => {
    const textarea = textareaRef.current;
    if (textarea) {
      textarea.style.height = "auto";
      textarea.style.height = `${Math.min(textarea.scrollHeight, 200)}px`;
    }
  };

  const charCount = value.length;
  const trimmedLength = value.trim().length;
  const hasText = trimmedLength > 0;
  const isOverLimit = trimmedLength > charLimit;
  const showCounter = charCount > charLimit * 0.75;

  const card = (
    <div className={`flex flex-col bg-white dark:bg-[#151926] rounded-2xl border border-[#E5E7EB] dark:border-white/7 px-4 pt-3 pb-2 transition-all duration-150 focus-within:border-[#2563EB]/50 dark:focus-within:border-[#4F8EF7]/50 focus-within:ring-2 focus-within:ring-[#2563EB]/15 dark:focus-within:ring-[#4F8EF7]/15 focus-within:shadow-[0_0_0_3px_rgba(37,99,235,0.08)] dark:focus-within:shadow-[0_0_0_3px_rgba(79,142,247,0.08)] ${floating ? "shadow-lg shadow-black/10 dark:shadow-black/30" : "shadow-sm dark:shadow-none"}`}>
          {/* Textarea — full width, expands from 1 row up to 200px */}
          <textarea
            ref={textareaRef}
            value={value}
            onChange={(e) => setValue(e.target.value)}
            onKeyDown={handleKeyDown}
            onInput={handleInput}
            placeholder="Jautā par jebkuru mācību tēmu..."
            disabled={disabled}
            rows={1}
            className="w-full bg-transparent text-sm text-[#111827] dark:text-[#E8ECF4] placeholder:text-[#6B7280] dark:placeholder:text-gray-400 resize-none outline-none max-h-[200px] disabled:opacity-50 overflow-y-auto thin-scrollbar"
          />

          {/* Bottom toolbar */}
          <div className="flex items-center justify-between mt-2">
            {/* Left: camera + book */}
            <div className="flex items-center gap-1">
              <button
                disabled
                className="p-1.5 text-[#6B7280] dark:text-[#8B95A8] opacity-40 cursor-not-allowed min-w-[44px] min-h-[44px] flex items-center justify-center rounded-full transition-opacity"
                aria-label="Pievienot attēlu"
                title="Drīzumā"
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  viewBox="0 0 24 24"
                  fill="currentColor"
                  className="h-5 w-5"
                >
                  <path d="M12 9a3.75 3.75 0 1 0 0 7.5A3.75 3.75 0 0 0 12 9Z" />
                  <path
                    fillRule="evenodd"
                    d="M9.344 3.071a49.52 49.52 0 0 1 5.312 0c.967.052 1.83.585 2.332 1.39l.821 1.317c.24.383.645.643 1.11.71.386.054.77.113 1.152.177 1.432.239 2.429 1.493 2.429 2.909V18a3 3 0 0 1-3 3h-15a3 3 0 0 1-3-3V9.574c0-1.416.997-2.67 2.429-2.909.382-.064.766-.123 1.151-.178a1.56 1.56 0 0 0 1.11-.71l.822-1.315a2.942 2.942 0 0 1 2.332-1.39ZM6.75 12.75a5.25 5.25 0 1 1 10.5 0 5.25 5.25 0 0 1-10.5 0Zm12-1.5a.75.75 0 1 0 0-1.5.75.75 0 0 0 0 1.5Z"
                    clipRule="evenodd"
                  />
                </svg>
              </button>

              <button
                disabled
                className="p-1.5 text-[#6B7280] dark:text-[#8B95A8] opacity-40 cursor-not-allowed flex items-center justify-center rounded-full"
                aria-label="Mācību materiāli"
                title="Funkcija drīzumā būs pieejama!"
              >
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4">
                  <path d="M10.75 16.82A7.462 7.462 0 0 1 15 15.5c.71 0 1.396.098 2.046.282A.75.75 0 0 0 18 15.06V3.44a.75.75 0 0 0-.525-.72A8.963 8.963 0 0 0 15 2.25a8.963 8.963 0 0 0-4.25 1.063v13.507ZM9.25 4.313A8.963 8.963 0 0 0 5 2.25c-.862 0-1.7.121-2.475.345a.75.75 0 0 0-.525.72v11.62a.75.75 0 0 0 .954.721A7.506 7.506 0 0 1 5 15.5c1.579 0 3.042.487 4.25 1.32V4.313Z" />
                </svg>
              </button>
            </div>

            {/* Right: char counter + stop / send */}
            <div className="flex items-center gap-2">
              {showCounter && (
                <span className={`text-[11px] tabular-nums ${isOverLimit ? "text-red-400" : "text-[#F59E0B]"}`}>
                  {charCount} / {charLimit.toLocaleString()}
                </span>
              )}
            {isGenerating ? (
              <button
                onClick={onStop}
                className="p-2 rounded-lg transition-all duration-150 shrink-0 bg-red-500/15 text-red-400 hover:bg-red-500/25 hover:scale-105"
                aria-label="Apturēt"
                title="Apturēt ģenerēšanu"
              >
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4">
                  <rect x="4" y="4" width="12" height="12" rx="1.5" />
                </svg>
              </button>
            ) : (
              <button
                onClick={handleSubmit}
                disabled={disabled || !hasText || isOverLimit}
                className={`p-2 rounded-lg transition-all duration-150 shrink-0 ${
                  hasText && !isOverLimit
                    ? "bg-[#2563EB] dark:bg-[#4F8EF7] text-white shadow-md shadow-[#2563EB]/25 dark:shadow-[#4F8EF7]/25 hover:bg-[#1D4ED8] dark:hover:bg-[#3D7CE5] hover:shadow-lg hover:shadow-[#2563EB]/35 dark:hover:shadow-[#4F8EF7]/35 hover:scale-105"
                    : "bg-[#F1F5F9] dark:bg-[#1A2033] text-[#6B7280] dark:text-[#8B95A8]"
                } disabled:opacity-30 disabled:cursor-not-allowed`}
                aria-label="Sūtīt"
              >
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4">
                  <path d="M3.105 2.288a.75.75 0 0 0-.826.95l1.414 4.926A1.5 1.5 0 0 0 5.135 9.25h6.115a.75.75 0 0 1 0 1.5H5.135a1.5 1.5 0 0 0-1.442 1.086l-1.414 4.926a.75.75 0 0 0 .826.95l14.095-5.637a.75.75 0 0 0 0-1.394L3.105 2.289Z" />
                </svg>
              </button>
            )}
            </div>
          </div>
        </div>
  );

  if (floating) {
    return (
      <div className="w-full">
        {card}
      </div>
    );
  }

  return (
    <div className="border-t border-[#E5E7EB] dark:border-white/7 bg-[#F9FAFB]/80 dark:bg-[#0B0E14]/80 backdrop-blur-sm px-6 py-3">
      <div className="max-w-3xl mx-auto">
        {card}
      </div>
    </div>
  );
}
