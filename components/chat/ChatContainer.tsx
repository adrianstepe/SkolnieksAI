"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import { ChatMessage, TypingIndicator, type Message } from "./ChatMessage";
import { ChatInput } from "./ChatInput";
import { SubjectGradeSelector } from "./SubjectGradeSelector";
import { SettingsPanel } from "@/components/settings/SettingsPanel";
import { useSettings } from "@/lib/context/settings-context";
import { useAuth } from "@/lib/context/auth-context";

const WIDTH_CLASS: Record<string, string> = {
  compact: "max-w-2xl",
  normal: "max-w-3xl",
  wide: "max-w-5xl",
};

export function ChatContainer() {
  const { settings } = useSettings();
  const { user, usage, signOut, getIdToken, refreshProfile } = useAuth();
  const [messages, setMessages] = useState<Message[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [subject, setSubject] = useState(settings.defaultSubject);
  const [grade, setGrade] = useState(settings.defaultGrade);
  const [showSettings, setShowSettings] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const maxW = WIDTH_CLASS[settings.chatWidth] ?? "max-w-3xl";

  const scrollToBottom = useCallback(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages, isLoading, scrollToBottom]);

  const handleSend = useCallback(
    async (text: string) => {
      const userMessage: Message = {
        id: `user-${Date.now()}`,
        role: "user",
        content: text,
      };

      setMessages((prev) => [...prev, userMessage]);
      setIsLoading(true);

      const assistantId = `assistant-${Date.now()}`;
      const assistantMessage: Message = {
        id: assistantId,
        role: "assistant",
        content: "",
      };

      setMessages((prev) => [...prev, assistantMessage]);

      try {
        // Build conversation history (last 6 messages)
        const history = messages.slice(-6).map((m) => ({
          role: m.role as "user" | "assistant",
          content: m.content,
        }));

        const token = await getIdToken();
        const response = await fetch("/api/chat", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
          body: JSON.stringify({
            message: text,
            subject,
            grade,
            model: settings.aiModel,
            conversationHistory: history,
          }),
        });

        if (!response.ok) {
          const error = await response.json().catch(() => ({})) as Record<string, string>;
          if (error.error === "token_budget_exceeded") {
            throw new Error("BUDGET_EXCEEDED");
          }
          throw new Error(error.error || `HTTP ${response.status}`);
        }

        const reader = response.body?.getReader();
        if (!reader) throw new Error("No response stream");

        const decoder = new TextDecoder();
        let buffer = "";

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split("\n");
          buffer = lines.pop() ?? "";

          for (const line of lines) {
            if (!line.startsWith("data: ")) continue;
            const jsonStr = line.slice(6);

            let event: Record<string, unknown>;
            try {
              event = JSON.parse(jsonStr) as Record<string, unknown>;
            } catch {
              continue;
            }

            if (event.type === "chunk") {
              setMessages((prev) =>
                prev.map((m) =>
                  m.id === assistantId
                    ? { ...m, content: m.content + (event.content as string) }
                    : m,
                ),
              );
            } else if (event.type === "sources") {
              setMessages((prev) =>
                prev.map((m) =>
                  m.id === assistantId
                    ? {
                        ...m,
                        sources: event.chunks as Message["sources"],
                      }
                    : m,
                ),
              );
            } else if (event.type === "error") {
              setMessages((prev) =>
                prev.map((m) =>
                  m.id === assistantId
                    ? {
                        ...m,
                        content: `K\u013C\u016Bda: ${event.message as string}`,
                      }
                    : m,
                ),
              );
            }
          }
        }
        // Refresh usage after successful response
        refreshProfile();
      } catch (err) {
        const errorMessage =
          err instanceof Error && err.message === "BUDGET_EXCEEDED"
            ? "Tavs mēneša limits ir sasniegts. Uzlabo plānu, lai turpinātu!"
            : `Kļūda: ${err instanceof Error ? err.message : "Nevarēja izveidot savienojumu"}`;
        setMessages((prev) =>
          prev.map((m) =>
            m.id === assistantId
              ? { ...m, content: errorMessage }
              : m,
          ),
        );
      } finally {
        setIsLoading(false);
      }
    },
    [messages, subject, grade, settings.aiModel, getIdToken, refreshProfile],
  );

  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <header className="shrink-0 border-b border-gray-200 bg-white px-4 py-3 dark:border-slate-700 dark:bg-slate-800">
        <div className={`mx-auto ${maxW}`}>
          <div className="flex items-center justify-between mb-2">
            <h1 className="text-lg font-semibold text-gray-900 dark:text-slate-100">
              Skolnieks<span className="text-brand-600">AI</span>
            </h1>
            <div className="flex items-center gap-2">
              {usage && (
                <UsageMeter percent={usage.budgetPercentUsed} />
              )}
              <button
                onClick={() => setShowSettings(true)}
                className="rounded-lg p-1.5 text-gray-500 transition-colors hover:bg-gray-100 dark:text-slate-400 dark:hover:bg-slate-700"
                aria-label="Iestatījumi"
              >
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="h-5 w-5">
                  <path fillRule="evenodd" d="M7.84 1.804A1 1 0 0 1 8.82 1h2.36a1 1 0 0 1 .98.804l.331 1.652a6.993 6.993 0 0 1 1.929 1.115l1.598-.54a1 1 0 0 1 1.186.447l1.18 2.044a1 1 0 0 1-.205 1.251l-1.267 1.113a7.047 7.047 0 0 1 0 2.228l1.267 1.113a1 1 0 0 1 .206 1.25l-1.18 2.045a1 1 0 0 1-1.187.447l-1.598-.54a6.993 6.993 0 0 1-1.929 1.115l-.33 1.652a1 1 0 0 1-.98.804H8.82a1 1 0 0 1-.98-.804l-.331-1.652a6.993 6.993 0 0 1-1.929-1.115l-1.598.54a1 1 0 0 1-1.186-.447l-1.18-2.044a1 1 0 0 1 .205-1.251l1.267-1.114a7.05 7.05 0 0 1 0-2.227L1.821 7.773a1 1 0 0 1-.206-1.25l1.18-2.045a1 1 0 0 1 1.187-.447l1.598.54A6.993 6.993 0 0 1 7.51 3.456l.33-1.652ZM10 13a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z" clipRule="evenodd" />
                </svg>
              </button>
              <button
                onClick={() => signOut()}
                className="rounded-lg p-1.5 text-gray-500 transition-colors hover:bg-gray-100 dark:text-slate-400 dark:hover:bg-slate-700"
                aria-label="Iziet"
                title="Iziet"
              >
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="h-5 w-5">
                  <path fillRule="evenodd" d="M3 4.25A2.25 2.25 0 0 1 5.25 2h5.5A2.25 2.25 0 0 1 13 4.25v2a.75.75 0 0 1-1.5 0v-2a.75.75 0 0 0-.75-.75h-5.5a.75.75 0 0 0-.75.75v11.5c0 .414.336.75.75.75h5.5a.75.75 0 0 0 .75-.75v-2a.75.75 0 0 1 1.5 0v2A2.25 2.25 0 0 1 10.75 18h-5.5A2.25 2.25 0 0 1 3 15.75V4.25Z" clipRule="evenodd" />
                  <path fillRule="evenodd" d="M19 10a.75.75 0 0 0-.75-.75H8.704l1.048-.943a.75.75 0 1 0-1.004-1.114l-2.5 2.25a.75.75 0 0 0 0 1.114l2.5 2.25a.75.75 0 1 0 1.004-1.114l-1.048-.943h9.546A.75.75 0 0 0 19 10Z" clipRule="evenodd" />
                </svg>
              </button>
            </div>
          </div>
          <SubjectGradeSelector
            subject={subject}
            grade={grade}
            onSubjectChange={setSubject}
            onGradeChange={setGrade}
          />
        </div>
      </header>

      {/* Messages */}
      <div
        ref={scrollRef}
        className="flex-1 overflow-y-auto px-4 py-4 hide-scrollbar"
      >
        <div className={`mx-auto ${maxW} space-y-4`}>
          {messages.length === 0 && (
            <EmptyState subject={subject} onSend={handleSend} />
          )}

          {messages.map((msg) => (
            <ChatMessage key={msg.id} message={msg} />
          ))}

          {isLoading &&
            messages[messages.length - 1]?.role === "assistant" &&
            messages[messages.length - 1]?.content === "" && (
              <TypingIndicator />
            )}
        </div>
      </div>

      {/* Input */}
      <ChatInput onSend={handleSend} disabled={isLoading} />

      {/* Settings drawer */}
      {showSettings && <SettingsPanel onClose={() => setShowSettings(false)} />}
    </div>
  );
}

function EmptyState({
  subject,
  onSend,
}: {
  subject: string;
  onSend: (text: string) => void;
}) {
  const suggestions: Record<string, string[]> = {
    math: [
      "K\u0101 atrisin\u0101t kvadr\u0101tvien\u0101dojumu?",
      "Paskaidro Pitagora teor\u0113mu",
      "Kas ir funkcijas grafiks?",
    ],
    latvian: [
      "K\u0101 analiz\u0113t dzejoli?",
      "Paskaidro teikuma locek\u013Cus",
      "Kas ir epitetss un metafora?",
    ],
    science: [
      "Kas ir fotosint\u0113ze?",
      "Paskaidro \u016Bdens aprites ciklu",
      "K\u0101 darbojas \u0161\u016Bnas?",
    ],
    history: [
      "Latvijas neatkar\u012Bbas pasludin\u0101\u0161ana",
      "Kas bija Atmodas laiks?",
      "Paskaidro Otro pasaules karu",
    ],
  };

  const items = suggestions[subject] ?? [
    "Uzdod jaut\u0101jumu par m\u0101c\u012Bbu vielu",
    "Paskaidro k\u0101du t\u0113mu",
    "Pal\u012Bdzi saprast uzdevumu",
  ];

  return (
    <div className="flex flex-col items-center justify-center py-12 text-center">
      <div className="mb-2 text-4xl">&#x1F393;</div>
      <h2 className="text-xl font-semibold text-gray-800 mb-1 dark:text-slate-200">
        Sveiki! Es esmu Skolnieks<span className="text-brand-600">AI</span>
      </h2>
      <p className="text-sm text-gray-500 mb-6 max-w-md dark:text-slate-400">
        Tavs m&#x0101;c&#x012B;bu pal&#x012B;gs, kas balst&#x012B;ts uz Skola2030 programmu.
        Uzdod jaut&#x0101;jumu, un es pal&#x012B;dz&#x0113;&#x0161;u saprast!
      </p>
      <div className="flex flex-col gap-2 w-full max-w-sm">
        {items.map((q) => (
          <button
            key={q}
            onClick={() => onSend(q)}
            className="rounded-xl border border-gray-200 bg-white px-4 py-3 text-left text-sm text-gray-700 transition-colors hover:border-brand-300 hover:bg-brand-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300 dark:hover:border-brand-700 dark:hover:bg-slate-700"
          >
            {q}
          </button>
        ))}
      </div>
    </div>
  );
}

function UsageMeter({ percent }: { percent: number }) {
  const color =
    percent >= 90
      ? "bg-red-500"
      : percent >= 70
        ? "bg-amber-500"
        : "bg-brand-500";

  const label =
    percent >= 100
      ? "Limits sasniegts"
      : percent >= 80
        ? "Gandrīz pilns"
        : "Lietojums";

  return (
    <div className="flex items-center gap-2" title={`${label}: ${percent}%`}>
      <div className="h-2 w-16 overflow-hidden rounded-full bg-gray-200 dark:bg-slate-700">
        <div
          className={`h-full rounded-full transition-all ${color}`}
          style={{ width: `${Math.min(100, percent)}%` }}
        />
      </div>
      <span className="text-xs text-gray-500 dark:text-slate-400">
        {percent}%
      </span>
    </div>
  );
}
