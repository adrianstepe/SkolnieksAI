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

const MAX_IMAGE_BYTES = 5 * 1024 * 1024;

interface ImageAttachment {
  base64: string;
  mimeType: string;
  previewUrl: string;
  filename: string;
}

interface ChatInputProps {
  onSend: (message: string, image?: { base64: string; mimeType: string }) => void;
  disabled?: boolean;
  isGenerating?: boolean;
  onStop?: () => void;
  pendingPrompt?: string;
  onPromptConsumed?: () => void;
  floating?: boolean;
  conversationId?: string;
}

export function ChatInput({
  onSend,
  disabled,
  isGenerating,
  onStop,
  pendingPrompt,
  onPromptConsumed,
  floating = false,
  conversationId: _conversationId,
}: ChatInputProps) {
  const { settings } = useSettings();
  const { profile } = useAuth();
  const charLimit = CHAR_LIMIT[profile?.tier ?? "free"];
  const canUploadImage =
    profile?.tier === "pro" ||
    profile?.tier === "premium" ||
    profile?.tier === "school_pro";
  const [value, setValue] = useState("");
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const [showPlusMenu, setShowPlusMenu] = useState(false);
  const [imageAttachment, setImageAttachment] = useState<ImageAttachment | null>(null);
  const [imageError, setImageError] = useState<string | null>(null);
  const plusMenuRef = useRef<HTMLDivElement>(null);
  const plusButtonRef = useRef<HTMLButtonElement>(null);

  // Close Plus menu on outside click
  useEffect(() => {
    if (!showPlusMenu) return;
    function handleClick(e: MouseEvent) {
      if (
        plusMenuRef.current &&
        !plusMenuRef.current.contains(e.target as Node) &&
        plusButtonRef.current &&
        !plusButtonRef.current.contains(e.target as Node)
      ) {
        setShowPlusMenu(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [showPlusMenu]);

  // Populate textarea when a starter prompt card is tapped
  useEffect(() => {
    if (!pendingPrompt) return;
    setValue(pendingPrompt);
    onPromptConsumed?.();
    requestAnimationFrame(() => {
      const textarea = textareaRef.current;
      if (textarea) {
        textarea.style.height = "auto";
        textarea.style.height = `${Math.min(textarea.scrollHeight, 200)}px`;
        textarea.focus();
      }
    });
  }, [pendingPrompt, onPromptConsumed]);

  async function handleFileSelect(file: File | null) {
    if (!file) return;
    if (file.size > MAX_IMAGE_BYTES) {
      setImageError("Attēls ir pārāk liels. Maksimālais izmērs: 5 MB.");
      return;
    }
    setImageError(null);
    setShowPlusMenu(false);

    // Read as base64
    const arrayBuffer = await file.arrayBuffer();
    const base64 = Buffer.from(arrayBuffer).toString("base64");
    const previewUrl = URL.createObjectURL(file);

    // Revoke previous preview
    if (imageAttachment) URL.revokeObjectURL(imageAttachment.previewUrl);

    setImageAttachment({
      base64,
      mimeType: file.type,
      previewUrl,
      filename: file.name,
    });
  }

  function handleInputChange(e: React.ChangeEvent<HTMLInputElement>) {
    void handleFileSelect(e.target.files?.[0] ?? null);
    e.target.value = "";
  }

  function handleCameraInput(e: React.ChangeEvent<HTMLInputElement>) {
    void handleFileSelect(e.target.files?.[0] ?? null);
    e.target.value = "";
  }

  function removeImageAttachment() {
    if (imageAttachment) URL.revokeObjectURL(imageAttachment.previewUrl);
    setImageAttachment(null);
    setImageError(null);
  }

  const handleSubmit = useCallback(() => {
    const trimmed = value.trim();
    if ((!trimmed && !imageAttachment) || disabled) return;
    const img = imageAttachment
      ? { base64: imageAttachment.base64, mimeType: imageAttachment.mimeType }
      : undefined;
    onSend(trimmed || "📎", img);
    setValue("");
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
    }
    if (imageAttachment) {
      URL.revokeObjectURL(imageAttachment.previewUrl);
      setImageAttachment(null);
    }
  }, [value, disabled, onSend, imageAttachment]);

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
  const hasContent = trimmedLength > 0 || imageAttachment !== null;
  const isOverLimit = trimmedLength > charLimit;
  const showCounter = charCount > charLimit * 0.75;

  const card = (
    <div
      className={`flex flex-col bg-white dark:bg-[#151926] rounded-2xl border border-[#E5E7EB] dark:border-white/7 px-4 pt-3 pb-2 transition-all duration-150 focus-within:border-[#2563EB]/50 dark:focus-within:border-[#4F8EF7]/50 focus-within:ring-2 focus-within:ring-[#2563EB]/15 dark:focus-within:ring-[#4F8EF7]/15 focus-within:shadow-[0_0_0_3px_rgba(37,99,235,0.08)] dark:focus-within:shadow-[0_0_0_3px_rgba(79,142,247,0.08)] ${floating ? "shadow-lg shadow-black/10 dark:shadow-black/30" : "shadow-sm dark:shadow-none"} cursor-text`}
      onClick={(e) => {
        if ((e.target as HTMLElement).closest("button")) return;
        textareaRef.current?.focus();
      }}
    >
      {/* Image preview strip */}
      {imageAttachment && (
        <div className="flex items-center gap-2 mb-2 pb-2 border-b border-[#E5E7EB] dark:border-white/7">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={imageAttachment.previewUrl}
            alt="Pievienotais attēls"
            className="h-14 w-14 rounded-lg object-cover shrink-0 border border-[#E5E7EB] dark:border-white/10"
          />
          <div className="flex-1 min-w-0">
            <p className="text-xs text-[#374151] dark:text-[#C9D1E0] truncate">{imageAttachment.filename}</p>
            <p className="text-[11px] text-[#9CA3AF] dark:text-[#5A6478]">Attēls pievienots</p>
          </div>
          <button
            onClick={removeImageAttachment}
            className="p-1 rounded-full text-[#6B7280] dark:text-[#8B95A8] hover:text-red-500 dark:hover:text-red-400 transition-colors shrink-0"
            aria-label="Noņemt attēlu"
          >
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4">
              <path d="M6.28 5.22a.75.75 0 0 0-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 1 0 1.06 1.06L10 11.06l3.72 3.72a.75.75 0 1 0 1.06-1.06L11.06 10l3.72-3.72a.75.75 0 0 0-1.06-1.06L10 8.94 6.28 5.22Z" />
            </svg>
          </button>
        </div>
      )}

      {/* Image error */}
      {imageError && (
        <p className="text-xs text-red-500 dark:text-red-400 mb-1.5">{imageError}</p>
      )}

      {/* Textarea */}
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
        {/* Left: Plus menu + book */}
        <div className="flex items-center gap-1">
          {/* Plus button with dropdown menu */}
          <div className="relative">
            <button
              ref={plusButtonRef}
              onClick={() => setShowPlusMenu((v) => !v)}
              className="p-1.5 text-[#6B7280] dark:text-[#8B95A8] hover:text-[#2563EB] dark:hover:text-[#4F8EF7] min-w-[44px] min-h-[44px] flex items-center justify-center rounded-full transition-colors"
              aria-label="Pievienot"
              aria-expanded={showPlusMenu}
            >
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="h-5 w-5">
                <path d="M10.75 4.75a.75.75 0 0 0-1.5 0v4.5h-4.5a.75.75 0 0 0 0 1.5h4.5v4.5a.75.75 0 0 0 1.5 0v-4.5h4.5a.75.75 0 0 0 0-1.5h-4.5v-4.5Z" />
              </svg>
            </button>

            {/* Dropdown menu */}
            {showPlusMenu && (
              <div
                ref={plusMenuRef}
                className="absolute bottom-full left-0 mb-1 w-48 rounded-xl border border-[#E5E7EB] dark:border-white/10 bg-white dark:bg-[#151926] shadow-lg overflow-hidden z-50"
              >
                {canUploadImage ? (
                  <>
                    <button
                      onClick={() => { fileInputRef.current?.click(); setShowPlusMenu(false); }}
                      className="flex items-center gap-2.5 w-full px-3 py-2.5 text-sm text-[#111827] dark:text-[#E8ECF4] hover:bg-[#F1F5F9] dark:hover:bg-[#1A2033] transition-colors text-left"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4 text-[#6B7280] dark:text-[#8B95A8] shrink-0">
                        <path fillRule="evenodd" d="M15.621 4.379a3 3 0 0 0-4.242 0l-7 7a3 3 0 0 0 4.241 4.243h.001l.497-.5a.75.75 0 0 1 1.064 1.057l-.498.501-.002.002a4.5 4.5 0 0 1-6.364-6.364l7-7a4.5 4.5 0 0 1 6.368 6.36l-3.455 3.553A2.625 2.625 0 1 1 9.52 9.52l3.45-3.451a.75.75 0 1 1 1.061 1.06l-3.45 3.451a1.125 1.125 0 0 0 1.587 1.595l3.454-3.553a3 3 0 0 0 0-4.242Z" clipRule="evenodd" />
                      </svg>
                      Pievienot attēlu
                    </button>
                    <button
                      onClick={() => { cameraInputRef.current?.click(); setShowPlusMenu(false); }}
                      className="sm:hidden flex items-center gap-2.5 w-full px-3 py-2.5 text-sm text-[#111827] dark:text-[#E8ECF4] hover:bg-[#F1F5F9] dark:hover:bg-[#1A2033] transition-colors text-left border-t border-[#E5E7EB] dark:border-white/7"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4 text-[#6B7280] dark:text-[#8B95A8] shrink-0">
                        <path fillRule="evenodd" d="M1 8a2 2 0 0 1 2-2h.93a2 2 0 0 0 1.664-.89l.812-1.22A2 2 0 0 1 8.07 3h3.86a2 2 0 0 1 1.664.89l.812 1.22A2 2 0 0 0 16.07 6H17a2 2 0 0 1 2 2v7a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8Zm13.5 3a4.5 4.5 0 1 1-9 0 4.5 4.5 0 0 1 9 0ZM10 14a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z" clipRule="evenodd" />
                      </svg>
                      Uzņemt foto
                    </button>
                  </>
                ) : (
                  <div className="flex items-center gap-2.5 w-full px-3 py-2.5 text-sm text-[#9CA3AF] dark:text-[#5A6478] cursor-not-allowed select-none">
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4 shrink-0 opacity-50">
                      <path fillRule="evenodd" d="M15.621 4.379a3 3 0 0 0-4.242 0l-7 7a3 3 0 0 0 4.241 4.243h.001l.497-.5a.75.75 0 0 1 1.064 1.057l-.498.501-.002.002a4.5 4.5 0 0 1-6.364-6.364l7-7a4.5 4.5 0 0 1 6.368 6.36l-3.455 3.553A2.625 2.625 0 1 1 9.52 9.52l3.45-3.451a.75.75 0 1 1 1.061 1.06l-3.45 3.451a1.125 1.125 0 0 0 1.587 1.595l3.454-3.553a3 3 0 0 0 0-4.242Z" clipRule="evenodd" />
                    </svg>
                    Pievienot attēlu
                    <span className="ml-auto rounded-full bg-amber-100 dark:bg-amber-900/30 px-1.5 py-0.5 text-[10px] font-semibold text-amber-600 dark:text-amber-400 leading-none">Pro</span>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Hidden file input */}
          <input
            ref={fileInputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            className="hidden"
            onChange={handleInputChange}
          />
          {/* Hidden camera input (mobile: opens native camera) */}
          <input
            ref={cameraInputRef}
            type="file"
            accept="image/*"
            capture="environment"
            className="hidden"
            onChange={handleCameraInput}
          />

          {/* Book / materials button (disabled, coming soon) */}
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
              disabled={disabled || !hasContent || isOverLimit}
              className={`p-2 rounded-lg transition-all duration-150 shrink-0 ${
                hasContent && !isOverLimit
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
    return <div className="w-full">{card}</div>;
  }

  return (
    <div className="border-t border-[#E5E7EB] dark:border-white/7 bg-[#F9FAFB]/80 dark:bg-[#0B0E14]/80 backdrop-blur-sm px-6 py-3">
      <div className="max-w-3xl mx-auto">
        {card}
      </div>
    </div>
  );
}
