"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import { ChatMessage, TypingIndicator, type Message } from "./ChatMessage";
import { ChatInput } from "./ChatInput";
import { SubjectGradeSelector } from "./SubjectGradeSelector";

export function ChatContainer() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [subject, setSubject] = useState("math");
  const [grade, setGrade] = useState(9);
  const scrollRef = useRef<HTMLDivElement>(null);

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

        const response = await fetch("/api/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            message: text,
            subject,
            grade,
            conversationHistory: history,
          }),
        });

        if (!response.ok) {
          const error = await response.json().catch(() => ({}));
          throw new Error(
            (error as Record<string, string>).error || `HTTP ${response.status}`,
          );
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
      } catch (err) {
        setMessages((prev) =>
          prev.map((m) =>
            m.id === assistantId
              ? {
                  ...m,
                  content: `K\u013C\u016Bda: ${err instanceof Error ? err.message : "Nevar\u0113ja izveidot savienojumu"}`,
                }
              : m,
          ),
        );
      } finally {
        setIsLoading(false);
      }
    },
    [messages, subject, grade],
  );

  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <header className="shrink-0 border-b border-gray-200 bg-white px-4 py-3">
        <div className="mx-auto max-w-3xl">
          <div className="flex items-center justify-between mb-2">
            <h1 className="text-lg font-semibold text-gray-900">
              Skolnieks<span className="text-brand-600">AI</span>
            </h1>
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
        <div className="mx-auto max-w-3xl space-y-4">
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
      <h2 className="text-xl font-semibold text-gray-800 mb-1">
        Sveiki! Es esmu Skolnieks<span className="text-brand-600">AI</span>
      </h2>
      <p className="text-sm text-gray-500 mb-6 max-w-md">
        Tavs m&#x0101;c&#x012B;bu pal&#x012B;gs, kas balst&#x012B;ts uz Skola2030 programmu.
        Uzdod jaut&#x0101;jumu, un es pal&#x012B;dz&#x0113;&#x0161;u saprast!
      </p>
      <div className="flex flex-col gap-2 w-full max-w-sm">
        {items.map((q) => (
          <button
            key={q}
            onClick={() => onSend(q)}
            className="rounded-xl border border-gray-200 bg-white px-4 py-3 text-left text-sm text-gray-700 transition-colors hover:border-brand-300 hover:bg-brand-50"
          >
            {q}
          </button>
        ))}
      </div>
    </div>
  );
}
