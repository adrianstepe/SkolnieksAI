"use client";

import { useState, useRef, useCallback } from "react";
import { useSettings } from "@/lib/context/settings-context";

interface ChatInputProps {
  onSend: (message: string) => void;
  disabled?: boolean;
  isGenerating?: boolean;
  onStop?: () => void;
}

export function ChatInput({ onSend, disabled, isGenerating, onStop }: ChatInputProps) {
  const { settings } = useSettings();
  const [value, setValue] = useState("");
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const handleSubmit = useCallback(() => {
    const trimmed = value.trim();
    if (!trimmed || disabled) return;
    onSend(trimmed);
    setValue("");
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
    }
  }, [value, disabled, onSend]);

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
      textarea.style.height = `${Math.min(textarea.scrollHeight, 160)}px`;
    }
  };

  const charCount = value.length;
  const trimmedLength = value.trim().length;
  const hasText = trimmedLength > 0;
  const isOverLimit = trimmedLength > 2000;
  const showCounter = charCount > 1500;

  return (
    <div className="border-t border-subtle bg-base/80 backdrop-blur-sm px-4 py-3">
      <div className="max-w-3xl mx-auto">
        {/* Card-style input container */}
        <div className="flex items-end gap-2 bg-[#151926] rounded-xl border border-primary/20 px-4 py-3 transition-all duration-150 focus-within:border-primary/50 focus-within:ring-2 focus-within:ring-primary/15 focus-within:shadow-[0_0_0_3px_rgba(79,142,247,0.08)]">
          {/* Paperclip button */}
          <button
            disabled
            className="p-1 text-muted-custom shrink-0 mb-0.5 opacity-40 cursor-not-allowed"
            aria-label="Pievienot failu"
            title="Funkcija drīzumā būs pieejama!"
          >
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4">
              <path fillRule="evenodd" d="M15.621 4.379a3 3 0 0 0-4.242 0l-7 7a3 3 0 0 0 4.241 4.243h.001l.497-.5a.75.75 0 0 1 1.064 1.057l-.498.501a4.5 4.5 0 0 1-6.364-6.364l7-7a4.5 4.5 0 0 1 6.368 6.36l-3.455 3.553A2.625 2.625 0 1 1 9.52 9.52l3.45-3.451a.75.75 0 1 1 1.061 1.06l-3.45 3.451a1.125 1.125 0 0 0 1.587 1.595l3.454-3.553a3 3 0 0 0 0-4.242Z" clipRule="evenodd" />
            </svg>
          </button>

          {/* Textarea */}
          <textarea
            ref={textareaRef}
            value={value}
            onChange={(e) => setValue(e.target.value)}
            onKeyDown={handleKeyDown}
            onInput={handleInput}
            placeholder="Uzdod jautājumu par mācību vielu..."
            disabled={disabled}
            rows={1}
            className="flex-1 bg-transparent text-sm text-primary-custom placeholder:text-muted-custom resize-none outline-none min-h-[24px] max-h-[160px] disabled:opacity-50"
          />

          {/* Book button */}
          <button
            disabled
            className="p-1 text-muted-custom shrink-0 mb-0.5 opacity-40 cursor-not-allowed"
            aria-label="Mācību materiāli"
            title="Funkcija drīzumā būs pieejama!"
          >
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4">
              <path d="M10.75 16.82A7.462 7.462 0 0 1 15 15.5c.71 0 1.396.098 2.046.282A.75.75 0 0 0 18 15.06V3.44a.75.75 0 0 0-.525-.72A8.963 8.963 0 0 0 15 2.25a8.963 8.963 0 0 0-4.25 1.063v13.507ZM9.25 4.313A8.963 8.963 0 0 0 5 2.25c-.862 0-1.7.121-2.475.345a.75.75 0 0 0-.525.72v11.62a.75.75 0 0 0 .954.721A7.506 7.506 0 0 1 5 15.5c1.579 0 3.042.487 4.25 1.32V4.313Z" />
            </svg>
          </button>

          {/* Stop / Send button */}
          {isGenerating ? (
            <button
              onClick={onStop}
              className="p-2 rounded-lg transition-all duration-150 shrink-0 mb-0.5 bg-red-500/15 text-red-400 hover:bg-red-500/25 hover:scale-105"
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
              className={`p-2 rounded-lg transition-all duration-150 shrink-0 mb-0.5 ${
                hasText && !isOverLimit
                  ? "bg-primary text-white shadow-md shadow-primary/25 hover:bg-primary-hover hover:shadow-lg hover:shadow-primary/35 hover:scale-105"
                  : "bg-muted text-muted-custom"
              } disabled:opacity-30 disabled:cursor-not-allowed`}
              aria-label="Sūtīt"
            >
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4">
                <path d="M3.105 2.288a.75.75 0 0 0-.826.95l1.414 4.926A1.5 1.5 0 0 0 5.135 9.25h6.115a.75.75 0 0 1 0 1.5H5.135a1.5 1.5 0 0 0-1.442 1.086l-1.414 4.926a.75.75 0 0 0 .826.95l14.095-5.637a.75.75 0 0 0 0-1.394L3.105 2.289Z" />
              </svg>
            </button>
          )}
        </div>

        {/* Character counter */}
        {showCounter && (
          <p className={`text-[11px] text-right mt-1 tabular-nums ${isOverLimit ? "text-red-400" : "text-warning"}`}>
            {charCount} / 2000
          </p>
        )}

        {/* Disclaimer text below input */}
        <p className="text-[11px] text-muted-custom text-center mt-2 flex items-center justify-center gap-1">
          <svg viewBox="0 0 24 24" fill="none" className="h-3 w-3">
            <path
              d="M12 2L14.5 9.5L22 12L14.5 14.5L12 22L9.5 14.5L2 12L9.5 9.5L12 2Z"
              fill="currentColor"
            />
          </svg>
          SkolnieksAI palīdz saprast, nevis atrisina tavā vietā
        </p>
      </div>
    </div>
  );
}
