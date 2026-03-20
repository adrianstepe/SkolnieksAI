"use client";

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

  return (
    <div
      className={`flex w-full ${isUser ? "justify-end" : "justify-start"}`}
    >
      <div
        className={`max-w-[85%] rounded-2xl px-4 py-3 text-[15px] leading-relaxed sm:max-w-[75%] ${
          isUser
            ? "bg-brand-600 text-white rounded-br-md"
            : "bg-white text-gray-800 shadow-sm border border-gray-100 rounded-bl-md"
        }`}
      >
        <div className="whitespace-pre-wrap break-words">
          {message.content}
        </div>

        {!isUser && message.sources && message.sources.length > 0 && (
          <div className="mt-3 border-t border-gray-100 pt-2">
            <p className="text-xs font-medium text-gray-400 mb-1">
              Avoti:
            </p>
            <div className="flex flex-wrap gap-1">
              {message.sources.map((source) => (
                <span
                  key={source.id}
                  className="inline-block rounded-full bg-brand-50 px-2 py-0.5 text-xs text-brand-700"
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
      <div className="rounded-2xl rounded-bl-md bg-white px-4 py-3 shadow-sm border border-gray-100">
        <div className="flex items-center gap-1.5">
          <span className="h-2 w-2 rounded-full bg-gray-300 animate-bounce [animation-delay:0ms]" />
          <span className="h-2 w-2 rounded-full bg-gray-300 animate-bounce [animation-delay:150ms]" />
          <span className="h-2 w-2 rounded-full bg-gray-300 animate-bounce [animation-delay:300ms]" />
        </div>
      </div>
    </div>
  );
}
