"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import { ChatMessage, TypingIndicator, type Message } from "./ChatMessage";
import { ChatInput } from "./ChatInput";
import { Sidebar, type RecentChat } from "./Sidebar";
import { SettingsPanel } from "@/components/settings/SettingsPanel";
import { UpgradeModal } from "./UpgradeModal";
import { useSettings } from "@/lib/context/settings-context";
import { useAuth } from "@/lib/context/auth-context";
import { detectSubject } from "@/lib/utils/detect-subject";

const SUBJECT_LABELS: Record<string, string> = {
  general: "Vispārīgi",
  math: "Matemātika",
  physics: "Fizika",
  chemistry: "Ķīmija",
  biology: "Bioloģija",
  history: "Vēsture",
  geography: "Ģeogrāfija",
  latvian: "Latviešu valoda",
  english: "Angļu valoda",
  informatics: "Datorzinātne",
  art: "Vizuālā māksla",
};

type NavTab = "learn" | "tasks" | "progress";
type SystemError = { message: string; type: "billing" | "rate_limit" | "general" } | null;

export function ChatContainer() {
  const { settings } = useSettings();
  const { user, usage, profile, signOut, getIdToken, refreshProfile } =
    useAuth();
  const [messages, setMessages] = useState<Message[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [subject, setSubject] = useState(settings.defaultSubject);
  const [grade, setGrade] = useState(settings.defaultGrade);
  const [showSettings, setShowSettings] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [showUpgrade, setShowUpgrade] = useState(false);
  const [activeTab, setActiveTab] = useState<NavTab>("learn");
  const scrollRef = useRef<HTMLDivElement>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  // Conversation state
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [recentChats, setRecentChats] = useState<RecentChat[]>([]);
  const [loadingChat, setLoadingChat] = useState(false);

  const [systemError, setSystemError] = useState<SystemError>(null);
  const [detectedSubjectLabel, setDetectedSubjectLabel] = useState<string | null>(null);

  useEffect(() => {
    if (!detectedSubjectLabel) return;
    const timer = setTimeout(() => setDetectedSubjectLabel(null), 4000);
    return () => clearTimeout(timer);
  }, [detectedSubjectLabel]);

  const scrollToBottom = useCallback(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages, isLoading, scrollToBottom]);

  // Fetch recent conversations on mount and after sending
  const fetchRecentChats = useCallback(async () => {
    try {
      const token = await getIdToken();
      if (!token) return;
      const res = await fetch("/api/conversations", {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = (await res.json()) as {
          conversations: Array<{
            id: string;
            title: string;
            subject: string;
          }>;
        };
        setRecentChats(
          data.conversations.map((c) => ({
            id: c.id,
            title: c.title,
            subject: c.subject,
          })),
        );
      }
    } catch {
      // Silently fail — sidebar will just show empty
    }
  }, [getIdToken]);

  useEffect(() => {
    if (user) {
      fetchRecentChats();
    }
  }, [user, fetchRecentChats]);

  // Load a conversation's messages
  const handleChatSelect = useCallback(
    async (chatId: string) => {
      if (chatId === conversationId || loadingChat) return;
      setLoadingChat(true);
      setActiveTab("learn");

      try {
        const token = await getIdToken();
        if (!token) return;
        const res = await fetch(`/api/conversations/${chatId}/messages`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!res.ok) return;

        const data = (await res.json()) as {
          conversation: { id: string; subject: string; grade: number };
          messages: Array<{ id: string; role: string; content: string }>;
        };

        setConversationId(chatId);
        setSubject(data.conversation.subject);
        setGrade(data.conversation.grade);
        setMessages(
          data.messages.map((m) => ({
            id: m.id,
            role: m.role as "user" | "assistant",
            content: m.content,
          })),
        );
      } catch {
        // Failed to load — stay on current view
      } finally {
        setLoadingChat(false);
      }
    },
    [conversationId, loadingChat, getIdToken],
  );

  // Start a new conversation
  const handleNewChat = useCallback(() => {
    setConversationId(null);
    setMessages([]);
    setActiveTab("learn");
  }, []);

  // Delete a conversation
  const handleChatDelete = useCallback(
    async (chatId: string) => {
      try {
        const token = await getIdToken();
        if (!token) return;
        const res = await fetch(`/api/conversations/${chatId}`, {
          method: "DELETE",
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!res.ok) return;
        // Remove from sidebar list
        setRecentChats((prev) => prev.filter((c) => c.id !== chatId));
        // If the deleted conversation was active, clear the view
        if (conversationId === chatId) {
          setConversationId(null);
          setMessages([]);
        }
      } catch {
        // Silently fail
      }
    },
    [getIdToken, conversationId],
  );

  const handleStop = useCallback(() => {
    abortControllerRef.current?.abort();
  }, []);

  const handleSend = useCallback(
    async (text: string) => {
      const userMessage: Message = {
        id: `user-${Date.now()}`,
        role: "user",
        content: text,
      };

      // Auto-detect subject on the very first message of a new general conversation
      if (subject === "general" && messages.length === 0) {
        const detected = detectSubject(text);
        if (detected) {
          setSubject(detected);
          setDetectedSubjectLabel(SUBJECT_LABELS[detected] ?? detected);
        }
      }

      setMessages((prev) => [...prev, userMessage]);
      setSystemError(null);
      setIsLoading(true);

      const assistantId = `assistant-${Date.now()}`;
      const assistantMessage: Message = {
        id: assistantId,
        role: "assistant",
        content: "",
      };

      setMessages((prev) => [...prev, assistantMessage]);

      const controller = new AbortController();
      abortControllerRef.current = controller;

      try {
        const history = messages.slice(-6).map((m) => ({
          role: m.role as "user" | "assistant",
          content: m.content,
        }));

        const token = await getIdToken();
        const response = await fetch("/api/chat", {
          method: "POST",
          signal: controller.signal,
          headers: {
            "Content-Type": "application/json",
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
          body: JSON.stringify({
            message: text,
            subject,
            grade,
            model: settings.aiModel,
            conversationId: conversationId ?? undefined,
            conversationHistory: history,
          }),
        });

        if (!response.ok) {
          const error = (await response
            .json()
            .catch(() => ({}))) as Record<string, unknown>;
          if (error.error === "token_budget_exceeded") {
            throw new Error("BUDGET_EXCEEDED");
          }
          if (error.error === "daily_limit_exceeded") {
            throw new Error("DAILY_LIMIT_EXCEEDED");
          }
          if (error.error === "rate_limit_exceeded") {
            const mins = (error.minutesRemaining as number) ?? 180;
            throw new Error(`RATE_LIMITED:${mins}`);
          }
          throw new Error((error.error as string) || `HTTP ${response.status}`);
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

            if (event.type === "conversationId") {
              setConversationId(event.conversationId as string);
            } else if (event.type === "chunk") {
              setMessages((prev) =>
                prev.map((m) =>
                  m.id === assistantId
                    ? {
                        ...m,
                        content: m.content + (event.content as string),
                      }
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
                        webSources: (event.webSources ?? []) as Message["webSources"],
                        usedWebSearch: Boolean(event.usedWebSearch),
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
                        content: `Kļūda: ${event.message as string}`,
                      }
                    : m,
                ),
              );
            }
          }
        }
        refreshProfile();
        // Refresh sidebar after new message
        fetchRecentChats();
      } catch (err) {
        // User-initiated abort — keep partial content, show nothing
        if (err instanceof DOMException && err.name === "AbortError") {
          return;
        }

        // Remove the empty assistant bubble — error is shown as a banner, not in chat
        setMessages((prev) => prev.filter((m) => m.id !== assistantId));

        const msg = err instanceof Error ? err.message : "";
        const isBudgetExceeded = msg === "BUDGET_EXCEEDED";
        const isDailyLimitExceeded = msg === "DAILY_LIMIT_EXCEEDED";
        const isRateLimited = msg.startsWith("RATE_LIMITED:");

        if (isBudgetExceeded || isDailyLimitExceeded) {
          setShowUpgrade(true);
        }

        if (isBudgetExceeded) {
          setSystemError({
            message: "Tavs mēneša limits ir sasniegts. Uzlabo plānu, lai turpinātu!",
            type: "billing",
          });
        } else if (isDailyLimitExceeded) {
          setSystemError({
            message: "Šodien esi sasniedzis dienas jautājumu limitu. Atgriezies rīt vai uzlabo plānu!",
            type: "billing",
          });
        } else if (isRateLimited) {
          const mins = parseInt(msg.split(":")[1] ?? "180", 10);
          const hours = Math.floor(mins / 60);
          const remainingMins = mins % 60;
          const timeStr = hours > 0
            ? `${hours} st. ${remainingMins > 0 ? `${remainingMins} min.` : ""}`.trim()
            : `${mins} min.`;
          setSystemError({
            message: `Pārāk daudz jautājumu īsā laikā. Pagaidi ${timeStr} un mēģini vēlreiz.`,
            type: "rate_limit",
          });
        } else {
          setSystemError({
            message: `Nevarēja izveidot savienojumu. Lūdzu, mēģini vēlreiz.`,
            type: "general",
          });
        }
      } finally {
        abortControllerRef.current = null;
        setIsLoading(false);
      }
    },
    [messages, subject, grade, settings.aiModel, conversationId, getIdToken, refreshProfile, fetchRecentChats],
  );

  const isPremium =
    profile?.tier === "premium" ||
    profile?.tier === "exam_prep" ||
    profile?.tier === "school_pro";

  const hasMessages = messages.length > 0;
  const sidebarWidth = sidebarCollapsed ? "lg:ml-16" : "lg:ml-64";

  return (
    <div className="flex h-full">
      {/* Sidebar */}
      <Sidebar
        activeSubject={subject}
        onSubjectChange={setSubject}
        recentChats={recentChats}
        activeChatId={conversationId}
        onChatSelect={handleChatSelect}
        onChatDelete={handleChatDelete}
        onNewChat={handleNewChat}
        mobileOpen={sidebarOpen}
        onMobileClose={() => setSidebarOpen(false)}
        userName={profile?.displayName ?? user?.displayName ?? user?.email?.split("@")[0]}
        userEmail={user?.email ?? undefined}
        userGrade={grade}
        collapsed={sidebarCollapsed}
        onToggleCollapse={() => setSidebarCollapsed((c) => !c)}
        onSettingsOpen={() => setShowSettings(true)}
        onUpgradeOpen={() => setShowUpgrade(true)}
        onSignOut={signOut}
        isPremium={isPremium}
      />

      {/* Main area */}
      <div className={`${sidebarWidth} flex flex-1 flex-col min-w-0 transition-all duration-300`}>
        {/* Header — h-14 with backdrop blur */}
        <header className="h-14 flex items-center justify-between px-4 lg:px-6 border-b border-subtle bg-base/50 backdrop-blur-sm shrink-0">
          <div className="flex items-center gap-3">
            {/* Hamburger — mobile only */}
            <button
              onClick={() => setSidebarOpen(true)}
              className="rounded-lg p-1.5 text-muted-custom transition-colors hover:bg-muted hover:text-primary-custom lg:hidden"
              aria-label="Atvērt izvēlni"
            >
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="h-5 w-5">
                <path fillRule="evenodd" d="M2 4.75A.75.75 0 0 1 2.75 4h14.5a.75.75 0 0 1 0 1.5H2.75A.75.75 0 0 1 2 4.75ZM2 10a.75.75 0 0 1 .75-.75h14.5a.75.75 0 0 1 0 1.5H2.75A.75.75 0 0 1 2 10Zm0 5.25a.75.75 0 0 1 .75-.75h14.5a.75.75 0 0 1 0 1.5H2.75a.75.75 0 0 1-.75-.75Z" clipRule="evenodd" />
              </svg>
            </button>

            {/* Status text */}
            <span className="text-sm text-muted-custom hidden sm:inline">
              {hasMessages ? "Aktīva saruna" : "Jauna saruna"}
            </span>

            {/* Nav tabs */}
            <nav className="hidden items-center gap-1 md:flex ml-2">
              <button
                onClick={() => setActiveTab("learn")}
                className={`rounded-lg px-3 py-1.5 text-sm transition-colors ${
                  activeTab === "learn"
                    ? "font-medium text-primary"
                    : "text-muted-custom hover:text-primary-custom"
                }`}
              >
                Mācīties
              </button>
              <button
                onClick={() => setActiveTab("tasks")}
                className={`rounded-lg px-3 py-1.5 text-sm transition-colors ${
                  activeTab === "tasks"
                    ? "font-medium text-primary"
                    : "text-muted-custom hover:text-primary-custom"
                }`}
              >
                Uzdevumi
              </button>
              <button
                onClick={() => setActiveTab("progress")}
                className={`rounded-lg px-3 py-1.5 text-sm transition-colors ${
                  activeTab === "progress"
                    ? "font-medium text-primary"
                    : "text-muted-custom hover:text-primary-custom"
                }`}
              >
                Progress
              </button>
            </nav>
          </div>

          <div className="flex items-center gap-3">
            {/* Skola2030 badge */}
            <span className="hidden px-2 py-1 rounded bg-success/10 text-success text-[11px] font-medium sm:inline-block">
              Skola2030
            </span>

            {/* Usage meter */}
            {usage && <UsageMeter percent={usage.budgetPercentUsed} queriesCount={usage.queriesCount} />}

            {/* Upgrade / Premium button */}
            {!isPremium && (
              <button
                onClick={() => setShowUpgrade(true)}
                className="flex items-center gap-1.5 rounded-full gradient-primary px-4 py-1.5 text-xs font-semibold text-white shadow-md shadow-primary/20 transition-all hover:shadow-lg hover:shadow-primary/25"
              >
                <svg viewBox="0 0 24 24" fill="none" className="h-3 w-3">
                  <path
                    d="M12 2L14.5 9.5L22 12L14.5 14.5L12 22L9.5 14.5L2 12L9.5 9.5L12 2Z"
                    fill="currentColor"
                  />
                </svg>
                Premium
              </button>
            )}

          </div>
        </header>

        {/* Subject auto-detect toast */}
        {detectedSubjectLabel && (
          <div className="animate-fade-up flex items-center justify-between gap-2 bg-primary/10 border-b border-primary/20 px-5 py-1.5 text-xs text-primary">
            <span>Automātiski noteikts priekšmets: <strong>{detectedSubjectLabel}</strong></span>
            <button onClick={() => setDetectedSubjectLabel(null)} className="text-primary/60 hover:text-primary">✕</button>
          </div>
        )}

        {/* Content area */}
        {activeTab === "learn" ? (
          <>
            {/* Chat messages area */}
            <div
              ref={scrollRef}
              className="flex-1 overflow-y-auto bg-chat px-6 py-6 thin-scrollbar"
            >
              {!hasMessages && !loadingChat ? (
                <WelcomeScreen onSelectPrompt={handleSend} onSubjectChange={setSubject} />
              ) : (
                <div className="mx-auto max-w-3xl space-y-6">
                  {loadingChat ? (
                    <ChatSkeleton />
                  ) : (
                    <>
                      {messages.map((msg) => (
                        <ChatMessage key={msg.id} message={msg} />
                      ))}

                      {isLoading &&
                        messages[messages.length - 1]?.role === "assistant" &&
                        messages[messages.length - 1]?.content === "" && (
                          <TypingIndicator />
                        )}
                    </>
                  )}
                </div>
              )}
            </div>

            {/* System error banner */}
            {systemError && (
              <div
                className={`px-4 py-3 border-t shrink-0 ${
                  systemError.type === "general"
                    ? "bg-red-500/10 border-red-500/20"
                    : "bg-warning/10 border-warning/20"
                }`}
              >
                <div className="max-w-3xl mx-auto flex items-start gap-3">
                  {/* Icon */}
                  <div
                    className={`shrink-0 mt-0.5 ${
                      systemError.type === "general" ? "text-red-400" : "text-warning"
                    }`}
                  >
                    {systemError.type === "rate_limit" ? (
                      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4">
                        <path fillRule="evenodd" d="M10 18a8 8 0 1 0 0-16 8 8 0 0 0 0 16Zm.75-13a.75.75 0 0 0-1.5 0v5c0 .414.336.75.75.75h4a.75.75 0 0 0 0-1.5h-3.25V5Z" clipRule="evenodd" />
                      </svg>
                    ) : (
                      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4">
                        <path fillRule="evenodd" d="M8.485 2.495c.673-1.167 2.357-1.167 3.03 0l6.28 10.875c.673 1.167-.17 2.625-1.516 2.625H3.72c-1.347 0-2.189-1.458-1.515-2.625L8.485 2.495ZM10 5a.75.75 0 0 1 .75.75v3.5a.75.75 0 0 1-1.5 0v-3.5A.75.75 0 0 1 10 5Zm0 9a1 1 0 1 0 0-2 1 1 0 0 0 0 2Z" clipRule="evenodd" />
                      </svg>
                    )}
                  </div>

                  {/* Message */}
                  <p
                    className={`flex-1 text-sm ${
                      systemError.type === "general" ? "text-red-300" : "text-warning"
                    }`}
                  >
                    {systemError.message}
                    {systemError.type === "billing" && (
                      <button
                        onClick={() => setShowUpgrade(true)}
                        className="ml-2 underline underline-offset-2 hover:opacity-80 transition-opacity"
                      >
                        Uzzināt vairāk
                      </button>
                    )}
                  </p>

                  {/* Dismiss */}
                  <button
                    onClick={() => setSystemError(null)}
                    className="shrink-0 text-muted-custom hover:text-primary-custom transition-colors"
                    aria-label="Aizvērt"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4">
                      <path d="M6.28 5.22a.75.75 0 0 0-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 1 0 1.06 1.06L10 11.06l3.72 3.72a.75.75 0 1 0 1.06-1.06L11.06 10l3.72-3.72a.75.75 0 0 0-1.06-1.06L10 8.94 6.28 5.22Z" />
                    </svg>
                  </button>
                </div>
              </div>
            )}

            {/* Input */}
            <ChatInput
              onSend={handleSend}
              disabled={isLoading || loadingChat}
              isGenerating={isLoading}
              onStop={handleStop}
            />
          </>
        ) : (
          /* Drīzumā placeholder for Uzdevumi & Progress */
          <div className="flex flex-1 items-center justify-center bg-chat">
            <div className="flex flex-col items-center text-center">
              <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-surface">
                {activeTab === "tasks" ? (
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="h-8 w-8 text-muted-custom">
                    <path fillRule="evenodd" d="M7.502 6h7.128A3.375 3.375 0 0 1 18 9.375v9.375a3 3 0 0 0 3-3V6.108c0-1.505-1.125-2.811-2.664-2.94a48.972 48.972 0 0 0-.673-.05A3 3 0 0 0 15 1.5h-1.5a3 3 0 0 0-2.663 1.618c-.225.015-.45.032-.673.05C8.662 3.295 7.554 4.542 7.502 6ZM13.5 3a1.5 1.5 0 0 0-1.5 1.5H15A1.5 1.5 0 0 0 13.5 3ZM7.5 9.375A1.875 1.875 0 0 1 9.375 7.5h5.25a1.875 1.875 0 0 1 1.875 1.875v9.375A1.875 1.875 0 0 1 14.625 20.625h-5.25A1.875 1.875 0 0 1 7.5 18.75V9.375Z" clipRule="evenodd" />
                    <path d="M10.5 12.75a.75.75 0 0 1 .75-.75h1.5a.75.75 0 0 1 0 1.5h-1.5a.75.75 0 0 1-.75-.75Zm0 3a.75.75 0 0 1 .75-.75h1.5a.75.75 0 0 1 0 1.5h-1.5a.75.75 0 0 1-.75-.75Z" />
                  </svg>
                ) : (
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="h-8 w-8 text-muted-custom">
                    <path fillRule="evenodd" d="M2.25 13.5a8.25 8.25 0 0 1 8.25-8.25.75.75 0 0 1 .75.75v6.75H18a.75.75 0 0 1 .75.75 8.25 8.25 0 0 1-16.5 0Z" clipRule="evenodd" />
                    <path fillRule="evenodd" d="M12.75 3a.75.75 0 0 1 .75-.75 8.25 8.25 0 0 1 8.25 8.25.75.75 0 0 1-.75.75h-7.5a.75.75 0 0 1-.75-.75V3Z" clipRule="evenodd" />
                  </svg>
                )}
              </div>
              <h2 className="text-lg font-semibold text-primary-custom mb-2">
                {activeTab === "tasks" ? "Uzdevumi" : "Progress"}
              </h2>
              <p className="text-sm text-muted-custom max-w-xs">
                {activeTab === "tasks"
                  ? "Interaktīvi uzdevumi un testi — drīzumā!"
                  : "Tava mācīšanās statistika un sasniegumi — drīzumā!"}
              </p>
              <span className="mt-4 inline-block rounded-full bg-accent/10 px-4 py-1.5 text-sm font-medium text-accent">
                Drīzumā...
              </span>
            </div>
          </div>
        )}
      </div>

      {/* Settings drawer */}
      {showSettings && (
        <SettingsPanel onClose={() => setShowSettings(false)} />
      )}

      {/* Upgrade modal */}
      {showUpgrade && (
        <UpgradeModal onClose={() => setShowUpgrade(false)} />
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Welcome Screen (matches design-studio WelcomeScreen)
// ---------------------------------------------------------------------------

import { SUBJECTS } from "./SubjectGradeSelector";
import type { LucideIcon } from "lucide-react";

interface QuickStartCard {
  value: string;
  label: string;
  prompt: string;
  icon: LucideIcon;
}

const SUBJECT_ICON_MAP = Object.fromEntries(SUBJECTS.map((s) => [s.value, s.icon]));

const QUICK_STARTS: QuickStartCard[] = [
  {
    value: "biology",
    label: "Bioloģija",
    prompt: "Kas ir fotosintēze?",
    icon: SUBJECT_ICON_MAP.biology,
  },
  {
    value: "math",
    label: "Matemātika",
    prompt: "Izskaidro, kā atrisināt kvadrātvienādojumu",
    icon: SUBJECT_ICON_MAP.math,
  },
  {
    value: "physics",
    label: "Fizika",
    prompt: "Kas ir Ņūtona otrais likums?",
    icon: SUBJECT_ICON_MAP.physics,
  },
  {
    value: "geography",
    label: "Ģeogrāfija",
    prompt: "Izskaidro Latvijas klimata zonas",
    icon: SUBJECT_ICON_MAP.geography,
  },
  {
    value: "informatics",
    label: "Datorzinātne",
    prompt: "Kas ir mainīgais programmēšanā?",
    icon: SUBJECT_ICON_MAP.informatics,
  },
  {
    value: "general",
    label: "Vispārīgi",
    prompt: "Sveiki! Ko tu vari darīt?",
    icon: SUBJECT_ICON_MAP.general,
  },
];

function WelcomeScreen({
  onSelectPrompt,
  onSubjectChange,
}: {
  onSelectPrompt: (text: string) => void;
  onSubjectChange: (subject: string) => void;
}) {
  return (
    <div className="flex-1 flex flex-col items-center justify-center px-6 py-12 min-h-full animate-fade-in">
      {/* Hero */}
      <div className="text-center space-y-4 mb-10">
        <div className="w-16 h-16 rounded-2xl gradient-primary flex items-center justify-center mx-auto glow-primary animate-float">
          <svg viewBox="0 0 24 24" fill="none" className="h-8 w-8">
            <path
              d="M12 2L14.5 9.5L22 12L14.5 14.5L12 22L9.5 14.5L2 12L9.5 9.5L12 2Z"
              fill="white"
            />
          </svg>
        </div>
        <h1 className="text-[28px] font-semibold text-primary-custom tracking-tight">
          Sveiki! Es esmu <span className="text-primary">SkolnieksAI</span>
        </h1>
        <p className="text-sm text-muted-custom max-w-md mx-auto">
          Tavs mācību palīgs. Uzdod jautājumu — saņemsi skaidru atbildi latviešu valodā,
          balstoties uz Skola2030 programmu.
        </p>
      </div>

      {/* Quick-start cards grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 max-w-2xl w-full">
        {QUICK_STARTS.map((card, i) => (
          <button
            key={card.value}
            onClick={() => {
              onSubjectChange(card.value);
              onSelectPrompt(card.prompt);
            }}
            className="group flex flex-col items-start gap-3 p-4 rounded-xl bg-surface border border-subtle hover:border-primary/40 hover:bg-surface-hover hover:-translate-y-0.5 active:translate-y-0 active:scale-[0.98] transition-all duration-150 text-left animate-slide-up"
            style={{ animationDelay: `${i * 80}ms` }}
          >
            <div className="flex items-center gap-2">
              <card.icon className="h-4 w-4 shrink-0 text-muted-custom" />
              <span className="text-xs font-medium text-muted-custom">{card.label}</span>
            </div>
            <p className="text-[15px] font-semibold text-primary-custom leading-snug">{card.prompt}</p>
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-3.5 h-3.5 text-muted-custom group-hover:text-primary group-hover:translate-x-0.5 transition-all ml-auto">
              <path fillRule="evenodd" d="M3 10a.75.75 0 0 1 .75-.75h10.638L10.23 5.29a.75.75 0 1 1 1.04-1.08l5.5 5.25a.75.75 0 0 1 0 1.08l-5.5 5.25a.75.75 0 1 1-1.04-1.08l4.158-3.96H3.75A.75.75 0 0 1 3 10Z" clipRule="evenodd" />
            </svg>
          </button>
        ))}
      </div>

      {/* Footer badges */}
      <div className="mt-10 flex items-center gap-6 text-[11px] text-muted-custom">
        <span className="inline-flex items-center gap-1">📚 Atbilst Skola2030 standartiem</span>
        <span className="inline-flex items-center gap-1">🔒 Privāts un drošs</span>
        <span className="inline-flex items-center gap-1">🇱🇻 Latviski</span>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Chat skeleton loader
// ---------------------------------------------------------------------------

function SkeletonBubble({ align, widthClass }: { align: "left" | "right"; widthClass: string }) {
  return (
    <div className={`flex ${align === "right" ? "justify-end" : "justify-start"}`}>
      <div className={`${widthClass} h-10 rounded-2xl bg-surface animate-pulse`} />
    </div>
  );
}

function ChatSkeleton() {
  return (
    <div className="space-y-6 py-2">
      <SkeletonBubble align="right" widthClass="w-48" />
      <SkeletonBubble align="left"  widthClass="w-3/4" />
      <SkeletonBubble align="left"  widthClass="w-2/3" />
      <SkeletonBubble align="right" widthClass="w-36" />
      <SkeletonBubble align="left"  widthClass="w-4/5" />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Usage meter
// ---------------------------------------------------------------------------

function UsageMeter({ percent, queriesCount }: { percent: number; queriesCount?: number }) {
  const color =
    percent >= 90
      ? "bg-subj-chemistry"
      : percent >= 70
        ? "bg-warning"
        : "bg-primary";

  // Free tier is ~60 questions/month (per CLAUDE.md)
  const FREE_MONTHLY_BUDGET = 60;
  const used = queriesCount ?? Math.round(percent * FREE_MONTHLY_BUDGET / 100);
  const tooltipText = `${used} no ${FREE_MONTHLY_BUDGET} jautājumiem šomēnes`;

  return (
    <div
      className="hidden items-center gap-2 sm:flex cursor-default"
      title={tooltipText}
    >
      <div className="h-1.5 w-14 overflow-hidden rounded-full bg-muted">
        <div
          className={`h-full rounded-full transition-all ${color}`}
          style={{ width: `${Math.min(100, percent)}%` }}
        />
      </div>
      <span className="text-[11px] text-muted-custom">{percent}%</span>
    </div>
  );
}
