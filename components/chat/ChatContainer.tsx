"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import { ChatMessage, TypingIndicator, type Message } from "./ChatMessage";
import { ChatInput } from "./ChatInput";
import { Sidebar, type RecentChat } from "./Sidebar";
import { SettingsPanel } from "@/components/settings/SettingsPanel";
import { UpgradeModal } from "./UpgradeModal";
import { StreakIndicator } from "@/components/streak/StreakIndicator";
import { MilestoneCelebration } from "@/components/streak/MilestoneCelebration";
import { StreakBrokenModal } from "@/components/streak/StreakBrokenModal";
import { useSettings } from "@/lib/context/settings-context";
import { useAuth } from "@/lib/context/auth-context";
import { detectSubject } from "@/lib/utils/detect-subject";
import { starterPrompts, type StarterPrompt } from "@/lib/chat/starterPrompts";
import { getExamCountdown, EXAM_UPGRADE_KEYWORDS, normalizeLv } from "@/lib/exams/latvianExams";

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

  // Keep grade in sync when the user changes it in Settings
  useEffect(() => {
    setGrade(settings.defaultGrade);
  }, [settings.defaultGrade]);
  const [showSettings, setShowSettings] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [showUpgrade, setShowUpgrade] = useState(false);
  const [activeTab, setActiveTab] = useState<NavTab>("learn");
  const scrollRef = useRef<HTMLDivElement>(null);
  const abortControllerRef = useRef<AbortController | null>(null);
  const welcomeIconRef = useRef<HTMLDivElement>(null);

  // Conversation state
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [recentChats, setRecentChats] = useState<RecentChat[]>([]);
  const [loadingChat, setLoadingChat] = useState(false);

  const [systemError, setSystemError] = useState<SystemError>(null);
  const [detectedSubjectLabel, setDetectedSubjectLabel] = useState<string | null>(null);
  const [pendingPrompt, setPendingPrompt] = useState<string>("");

  // Streak-broken modal: show once per session when a notable streak resets to 1
  const [showStreakBroken, setShowStreakBroken] = useState(false);
  const [lostStreak, setLostStreak] = useState(0);
  const profileFirstLoadRef = useRef(false);

  // Inline exam upgrade banner — shown once per session after a relevant response
  const [showExamBanner, setShowExamBanner] = useState(false);

  useEffect(() => {
    // Fire only once, on the first profile load after login
    if (!profile || profileFirstLoadRef.current) return;
    profileFirstLoadRef.current = true;

    const { currentStreak, longestStreak } = profile;
    const sessionKey = "streak-broken-shown";

    if (
      currentStreak === 1 &&
      longestStreak >= 3 &&
      !sessionStorage.getItem(sessionKey)
    ) {
      sessionStorage.setItem(sessionKey, "true");
      setLostStreak(longestStreak);
      setShowStreakBroken(true);
    }
  }, [profile]);

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

        // Contextual exam upgrade banner: show once per session for eligible free users
        const currentGrade = profile?.grade ?? grade;
        const isFreeTier = !(
          profile?.tier === "pro" ||
          profile?.tier === "premium" ||
          profile?.tier === "school_pro"
        );
        if (
          isFreeTier &&
          (currentGrade === 9 || currentGrade === 12) &&
          !sessionStorage.getItem("hasShownExamUpgrade") &&
          EXAM_UPGRADE_KEYWORDS.some((kw) =>
            normalizeLv(text).includes(normalizeLv(kw)),
          )
        ) {
          sessionStorage.setItem("hasShownExamUpgrade", "true");
          setShowExamBanner(true);
        }
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
    [messages, subject, grade, settings.aiModel, conversationId, getIdToken, refreshProfile, fetchRecentChats, profile],
  );

  const handleOnboardingComplete = async () => {
    try {
      const token = await getIdToken();
      if (!token) return;
      await fetch("/api/auth/onboard", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ grade, subject }),
      });
      await refreshProfile();
    } catch (err) {
      console.error("Failed to complete onboarding:", err);
    }
  };

  const isPremium =
    profile?.tier === "pro" ||
    profile?.tier === "premium" ||
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
        userGrade={profile?.grade ?? grade}
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
        <header className="h-14 flex items-center justify-between px-4 lg:px-6 border-b border-[#E5E7EB] dark:border-white/7 bg-[#F9FAFB]/50 dark:bg-[#0F1117]/50 backdrop-blur-sm shrink-0">
          <div className="flex items-center gap-3">
            {/* Hamburger — mobile only */}
            <button
              onClick={() => setSidebarOpen(true)}
              className="rounded-lg p-1.5 text-[#6B7280] dark:text-[#8B95A8] transition-colors hover:bg-[#E5E7EB] dark:hover:bg-[#1A2033] hover:text-[#111827] dark:hover:text-[#E8ECF4] lg:hidden"
              aria-label="Atvērt izvēlni"
            >
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="h-5 w-5">
                <path fillRule="evenodd" d="M2 4.75A.75.75 0 0 1 2.75 4h14.5a.75.75 0 0 1 0 1.5H2.75A.75.75 0 0 1 2 4.75ZM2 10a.75.75 0 0 1 .75-.75h14.5a.75.75 0 0 1 0 1.5H2.75A.75.75 0 0 1 2 10Zm0 5.25a.75.75 0 0 1 .75-.75h14.5a.75.75 0 0 1 0 1.5H2.75a.75.75 0 0 1-.75-.75Z" clipRule="evenodd" />
              </svg>
            </button>

            {/* Status text */}
            <span className="text-sm font-semibold text-[#111827] dark:text-[#E8ECF4] hidden sm:inline">
              {hasMessages ? "Aktīva saruna" : "Jauna saruna"}
            </span>

            {/* Nav tabs */}
            <nav className="hidden items-center gap-1 md:flex ml-2">
              <button
                onClick={() => setActiveTab("learn")}
                className={`rounded-lg px-3 py-1.5 text-sm transition-colors ${
                  activeTab === "learn"
                    ? "font-bold text-[#1D4ED8] dark:text-[#3D7CE5]"
                    : "font-semibold text-[#111827] dark:text-[#E8ECF4] hover:bg-[#E5E7EB] dark:hover:bg-[#1A2033]"
                }`}
              >
                Mācīties
              </button>
              {(() => {
                const locked = recentChats.length < 3;
                return (
                  <>
                    <button
                      onClick={() => !locked && setActiveTab("tasks")}
                      disabled={locked}
                      title={locked ? "Pieejams pēc 3 sarunām" : undefined}
                      className={`rounded-lg px-3 py-1.5 text-sm transition-colors ${
                        locked
                          ? "opacity-40 cursor-not-allowed font-semibold text-[#111827] dark:text-[#E8ECF4]"
                          : activeTab === "tasks"
                          ? "font-bold text-[#1D4ED8] dark:text-[#3D7CE5]"
                          : "font-semibold text-[#111827] dark:text-[#E8ECF4] hover:bg-[#E5E7EB] dark:hover:bg-[#1A2033]"
                      }`}
                    >
                      Uzdevumi
                    </button>
                    <button
                      onClick={() => !locked && setActiveTab("progress")}
                      disabled={locked}
                      title={locked ? "Pieejams pēc 3 sarunām" : undefined}
                      className={`rounded-lg px-3 py-1.5 text-sm transition-colors ${
                        locked
                          ? "opacity-40 cursor-not-allowed font-semibold text-[#111827] dark:text-[#E8ECF4]"
                          : activeTab === "progress"
                          ? "font-bold text-[#1D4ED8] dark:text-[#3D7CE5]"
                          : "font-semibold text-[#111827] dark:text-[#E8ECF4] hover:bg-[#E5E7EB] dark:hover:bg-[#1A2033]"
                      }`}
                    >
                      Progress
                    </button>
                  </>
                );
              })()}
            </nav>
          </div>

          <div className="flex items-center gap-3">
            {/* Streak indicator */}
            <StreakIndicator anchorRef={!hasMessages && !loadingChat ? welcomeIconRef : undefined} />

            {/* Exam countdown badge — grades 9 and 12 only, within 90 days */}
            {(() => {
              const userGrade = profile?.grade ?? grade;
              const countdown = getExamCountdown(userGrade);
              if (!countdown || countdown.daysRemaining > 90) return null;
              const { daysRemaining } = countdown;
              const colorClass =
                daysRemaining < 30
                  ? "bg-red-500/15 border-red-500/25 text-red-600 dark:text-red-400"
                  : daysRemaining <= 60
                  ? "bg-amber-500/15 border-amber-500/25 text-amber-600 dark:text-amber-400"
                  : "bg-emerald-500/15 border-emerald-500/25 text-emerald-600 dark:text-emerald-400";
              const examTooltip = "Palicis laiks līdz eksāmenu sesijas sākumam";
              return (
                <div className="relative hidden sm:block">
                  <ExamCountdownBadge
                    daysRemaining={daysRemaining}
                    colorClass={colorClass}
                    label={countdown.label}
                    tooltip={examTooltip}
                  />
                </div>
              );
            })()}

            {/* Usage meter */}
            {usage && <UsageMeter percent={usage.budgetPercentUsed} queriesCount={usage.queriesCount} />}

            {/* Upgrade / Premium button (always visible next to progress bar) */}
            {!isPremium && (
              <button
                onClick={() => setShowUpgrade(true)}
                className="flex items-center gap-1 border border-[#2563EB] dark:border-[#4F8EF7] rounded-lg px-3 py-1 text-[#2563EB] dark:text-[#4F8EF7] text-sm font-medium hover:bg-[#2563EB]/10 transition-colors"
              >
                Uzlabot plānu
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4">
                  <path fillRule="evenodd" d="M3 10a.75.75 0 0 1 .75-.75h10.638L10.23 5.29a.75.75 0 1 1 1.04-1.08l5.5 5.25a.75.75 0 0 1 0 1.08l-5.5 5.25a.75.75 0 1 1-1.04-1.08l4.158-3.96H3.75A.75.75 0 0 1 3 10Z" clipRule="evenodd" />
                </svg>
              </button>
            )}

          </div>
        </header>

        {/* Subject auto-detect toast */}
        {detectedSubjectLabel && (
          <div className="animate-fade-up flex items-center justify-between gap-2 bg-[#2563EB]/10 dark:bg-[#4F8EF7]/10 border-b border-[#2563EB]/20 dark:border-[#4F8EF7]/20 px-5 py-1.5 text-xs text-[#2563EB] dark:text-[#4F8EF7]">
            <span>Automātiski noteikts priekšmets: <strong>{detectedSubjectLabel}</strong></span>
            <button onClick={() => setDetectedSubjectLabel(null)} className="text-[#2563EB]/60 dark:text-[#4F8EF7]/60 hover:text-[#2563EB] dark:hover:text-[#4F8EF7]">✕</button>
          </div>
        )}

        {/* Sticky Premium CTA Banner */}
        {!isPremium && usage && usage.budgetPercentUsed > 50 && (
          <div className="animate-fade-up flex items-center justify-center bg-[#2563EB]/10 dark:bg-[#4F8EF7]/10 border-b border-[#2563EB]/20 dark:border-[#4F8EF7]/20 px-5 py-2.5 text-sm shadow-sm shrink-0">
            <span className="text-[#111827] dark:text-[#E8ECF4] text-center">
              Tev atlikuši <strong className="text-[#2563EB] dark:text-[#4F8EF7]">{Math.max(0, 60 - (usage.queriesCount ?? 0))}</strong> jautājumi šomēnes.
            </span>
          </div>
        )}

        {/* Content area */}
        {activeTab === "learn" ? (
          <>
            {/* Chat messages area */}
            <div
              ref={scrollRef}
              className="flex-1 overflow-y-auto bg-[#F9FAFB] dark:bg-[#0B0E14] px-6 py-6 thin-scrollbar"
            >
              {!hasMessages && !loadingChat ? (
                <WelcomeScreen
                  onPopulateInput={setPendingPrompt}
                  currentGrade={grade}
                  iconRef={welcomeIconRef}
                />
              ) : (
                <div className="mx-auto max-w-3xl space-y-6">
                  {loadingChat ? (
                    <ChatSkeleton />
                  ) : (
                    <>
                      {messages.map((msg) => {
                        // Suppress the empty assistant placeholder while loading — TypingIndicator renders instead
                        if (
                          isLoading &&
                          msg.role === "assistant" &&
                          msg.content === "" &&
                          msg.id === messages[messages.length - 1]?.id
                        ) {
                          return null;
                        }
                        return <ChatMessage key={msg.id} message={msg} />;
                      })}

                      {isLoading && (() => {
                        const last = messages[messages.length - 1];
                        return last?.role === "user" || (last?.role === "assistant" && last.content === "");
                      })() && <TypingIndicator />}

                      {/* Inline exam upgrade banner — shown once per session after a relevant free-tier response */}
                      {showExamBanner && !isLoading && (
                        <div className="animate-fade-up flex items-center justify-between gap-3 rounded-xl border border-emerald-500/25 bg-emerald-500/10 px-4 py-3 text-sm">
                          <span className="text-emerald-700 dark:text-emerald-300 font-medium">
                            Gatavojies eksāmenam ar AI simulācijām →{" "}
                            <button
                              onClick={() => setShowUpgrade(true)}
                              className="underline underline-offset-2 hover:opacity-80 transition-opacity font-semibold"
                            >
                              Izmēģini Premium
                            </button>
                          </span>
                          <button
                            onClick={() => setShowExamBanner(false)}
                            className="shrink-0 text-emerald-600/60 dark:text-emerald-400/60 hover:text-emerald-700 dark:hover:text-emerald-300 transition-colors"
                            aria-label="Aizvērt"
                          >
                            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4">
                              <path d="M6.28 5.22a.75.75 0 0 0-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 1 0 1.06 1.06L10 11.06l3.72 3.72a.75.75 0 1 0 1.06-1.06L11.06 10l3.72-3.72a.75.75 0 0 0-1.06-1.06L10 8.94 6.28 5.22Z" />
                            </svg>
                          </button>
                        </div>
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
                    className="shrink-0 text-[#6B7280] dark:text-[#8B95A8] hover:text-[#111827] dark:hover:text-[#E8ECF4] transition-colors"
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
              pendingPrompt={pendingPrompt}
              onPromptConsumed={() => setPendingPrompt("")}
              subject={subject}
              onSubjectChange={setSubject}
            />
          </>
        ) : (
          /* Drīzumā placeholder for Uzdevumi & Progress */
          <div className="flex flex-1 items-center justify-center bg-[#F9FAFB] dark:bg-[#0B0E14]">
            <div className="flex flex-col items-center text-center">
              <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-[#F1F5F9] dark:bg-[#1A2033]">
                {activeTab === "tasks" ? (
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="h-8 w-8 text-[#6B7280] dark:text-[#8B95A8]">
                    <path fillRule="evenodd" d="M7.502 6h7.128A3.375 3.375 0 0 1 18 9.375v9.375a3 3 0 0 0 3-3V6.108c0-1.505-1.125-2.811-2.664-2.94a48.972 48.972 0 0 0-.673-.05A3 3 0 0 0 15 1.5h-1.5a3 3 0 0 0-2.663 1.618c-.225.015-.45.032-.673.05C8.662 3.295 7.554 4.542 7.502 6ZM13.5 3a1.5 1.5 0 0 0-1.5 1.5H15A1.5 1.5 0 0 0 13.5 3ZM7.5 9.375A1.875 1.875 0 0 1 9.375 7.5h5.25a1.875 1.875 0 0 1 1.875 1.875v9.375A1.875 1.875 0 0 1 14.625 20.625h-5.25A1.875 1.875 0 0 1 7.5 18.75V9.375Z" clipRule="evenodd" />
                    <path d="M10.5 12.75a.75.75 0 0 1 .75-.75h1.5a.75.75 0 0 1 0 1.5h-1.5a.75.75 0 0 1-.75-.75Zm0 3a.75.75 0 0 1 .75-.75h1.5a.75.75 0 0 1 0 1.5h-1.5a.75.75 0 0 1-.75-.75Z" />
                  </svg>
                ) : (
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="h-8 w-8 text-[#6B7280] dark:text-[#8B95A8]">
                    <path fillRule="evenodd" d="M2.25 13.5a8.25 8.25 0 0 1 8.25-8.25.75.75 0 0 1 .75.75v6.75H18a.75.75 0 0 1 .75.75 8.25 8.25 0 0 1-16.5 0Z" clipRule="evenodd" />
                    <path fillRule="evenodd" d="M12.75 3a.75.75 0 0 1 .75-.75 8.25 8.25 0 0 1 8.25 8.25.75.75 0 0 1-.75.75h-7.5a.75.75 0 0 1-.75-.75V3Z" clipRule="evenodd" />
                  </svg>
                )}
              </div>
              <h2 className="text-lg font-semibold text-[#111827] dark:text-[#E8ECF4] mb-2">
                {activeTab === "tasks" ? "Uzdevumi" : "Progress"}
              </h2>
              <p className="text-sm text-[#6B7280] dark:text-[#8B95A8] max-w-xs">
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
        <UpgradeModal onClose={() => setShowUpgrade(false)} grade={profile?.grade ?? grade} />
      )}

      {/* Streak broken modal */}
      {showStreakBroken && (
        <StreakBrokenModal
          lostStreak={lostStreak}
          onClose={() => setShowStreakBroken(false)}
        />
      )}

      {/* Milestone celebration toast */}
      <MilestoneCelebration />

      {/* Onboarding modal */}
      {profile && !profile.onboardingComplete && (
        <OnboardingModal
          currentGrade={grade}
          onGradeChange={setGrade}
          currentSubject={subject}
          onSubjectChange={setSubject}
          onComplete={handleOnboardingComplete}
        />
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Welcome Screen (matches design-studio WelcomeScreen)
// ---------------------------------------------------------------------------

import { SUBJECTS, GRADES } from "./SubjectGradeSelector";

function pickPrompts(grade: number, exclude?: StarterPrompt[]): StarterPrompt[] {
  const filtered = starterPrompts.filter((p) => p.grades.includes(grade));
  const pool = filtered.length >= 4 ? filtered : starterPrompts;
  const excludeTexts = new Set(exclude?.map((p) => p.text) ?? []);
  const available = pool.filter((p) => !excludeTexts.has(p.text));
  const source = available.length >= 4 ? available : pool;
  return [...source].sort(() => Math.random() - 0.5).slice(0, 4);
}

function WelcomeScreen({
  onPopulateInput,
  currentGrade,
  iconRef,
}: {
  onPopulateInput: (text: string) => void;
  currentGrade: number;
  iconRef?: React.RefObject<HTMLDivElement | null>;
}) {
  const [displayed, setDisplayed] = useState<StarterPrompt[]>(() =>
    pickPrompts(currentGrade)
  );

  const reshuffle = () => setDisplayed((prev) => pickPrompts(currentGrade, prev));

  return (
    <div className="flex-1 flex flex-col items-center justify-center px-4 py-10 min-h-full animate-fade-in">
      {/* Greeting */}
      <div className="text-center space-y-3 mb-8 w-full mt-[-8vh]">
        <div ref={iconRef} className="w-14 h-14 rounded-2xl gradient-primary flex items-center justify-center mx-auto glow-primary animate-float">
          <svg viewBox="0 0 24 24" fill="none" className="h-7 w-7">
            <path
              d="M12 2L14.5 9.5L22 12L14.5 14.5L12 22L9.5 14.5L2 12L9.5 9.5L12 2Z"
              fill="white"
            />
          </svg>
        </div>
        <h1 className="text-2xl font-semibold text-[#111827] dark:text-[#E8ECF4] tracking-tight">
          Sveiki! Ko šodien mācāmies?
        </h1>
        <p className="text-sm text-[#6B7280] dark:text-[#8B95A8] max-w-sm mx-auto">
          Izvēlies tēmu vai ieraksti savu jautājumu zemāk
        </p>
      </div>

      {/* 4 starter prompt cards — 2×2 on mobile, 1×4 on md+ */}
      <div className="w-full max-w-2xl grid grid-cols-2 md:grid-cols-4 gap-3 animate-slide-up">
        {displayed.map((prompt, i) => (
          <button
            key={i}
            onClick={() => onPopulateInput(prompt.text)}
            className="group flex flex-col gap-2 rounded-2xl border border-[#E5E7EB] dark:border-white/7 bg-white dark:bg-[#151926] p-4 text-left transition-all min-h-[88px] hover:border-[#2563EB] dark:hover:border-[#4F8EF7] hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2563EB] dark:focus-visible:ring-[#4F8EF7]"
            aria-label={prompt.text}
          >
            <div className="flex items-center gap-1.5">
              <span className="text-base leading-none" aria-hidden="true">
                {prompt.subjectEmoji}
              </span>
              <span className="text-[10px] font-semibold text-[#6B7280] dark:text-[#8B95A8] uppercase tracking-wider truncate">
                {prompt.subject}
              </span>
            </div>
            <p className="text-sm font-medium text-[#111827] dark:text-[#E8ECF4] leading-snug line-clamp-3">
              {prompt.text}
            </p>
          </button>
        ))}
      </div>

      {/* Reshuffle */}
      <button
        onClick={reshuffle}
        className="mt-4 text-xs text-[#6B7280] dark:text-[#8B95A8] hover:text-[#2563EB] dark:hover:text-[#4F8EF7] transition-colors underline underline-offset-2"
      >
        Rādīt citus jautājumus
      </button>

      {/* Trust badges */}
      <div className="mt-8 flex flex-wrap items-center justify-center gap-4 text-[11px] font-semibold text-[#6B7280] dark:text-[#8B95A8]">
        <span className="inline-flex items-center gap-1">📚 Balstīts uz OpenStax</span>
        <span className="inline-flex items-center gap-1">🔒 Privāts un drošs</span>
        <span className="inline-flex items-center gap-1">🇱🇻 Latviski</span>
      </div>
    </div>
  );
}

function OnboardingModal({
  currentGrade,
  onGradeChange,
  currentSubject,
  onSubjectChange,
  onComplete,
}: {
  currentGrade: number;
  onGradeChange: (grade: number) => void;
  currentSubject: string;
  onSubjectChange: (subject: string) => void;
  onComplete: () => Promise<void>;
}) {
  const [loading, setLoading] = useState(false);

  const handleSave = async () => {
    setLoading(true);
    await onComplete();
    setLoading(false);
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 animate-fade-in">
      <div className="w-full max-w-md rounded-3xl border border-[#E5E7EB] dark:border-white/7 bg-[#F9FAFB] dark:bg-[#1A2033] p-6 md:p-8 shadow-2xl animate-slide-up">
        {/* Icon */}
        <div className="mb-6 flex h-14 w-14 items-center justify-center rounded-2xl bg-[#2563EB]/10 dark:bg-[#4F8EF7]/10 text-[#2563EB] dark:text-[#4F8EF7]">
          <svg viewBox="0 0 24 24" fill="none" className="h-7 w-7">
            <path
              d="M12 2L14.5 9.5L22 12L14.5 14.5L12 22L9.5 14.5L2 12L9.5 9.5L12 2Z"
              fill="currentColor"
            />
          </svg>
        </div>

        <h2 className="text-2xl font-bold text-[#111827] dark:text-[#E8ECF4] mb-2">Iepazīsimies!</h2>
        <p className="text-sm text-[#6B7280] dark:text-[#8B95A8] mb-8">
          Izvēlies klasi un tēmu, lai mēs varētu pielāgot atbildes tavam līmenim.
        </p>

        {/* Grade */}
        <div className="mb-6">
          <label className="block text-sm font-medium text-[#111827] dark:text-[#E8ECF4] mb-3">Tava klase</label>
          <div className="flex flex-wrap gap-2.5">
            {GRADES.map((g) => (
              <button
                key={g}
                onClick={() => onGradeChange(g)}
                className={`flex h-11 w-11 items-center justify-center rounded-full text-sm font-semibold transition-all ${
                  currentGrade === g
                    ? "bg-[#2563EB] dark:bg-[#4F8EF7] text-white shadow-md shadow-[#2563EB]/25 dark:shadow-[#4F8EF7]/25 scale-105"
                    : "bg-[#F1F5F9] dark:bg-[#1A2033] border border-[#E5E7EB] dark:border-white/7 text-[#6B7280] dark:text-[#8B95A8] hover:border-[#2563EB]/50 dark:hover:border-[#4F8EF7]/50 hover:text-[#111827] dark:hover:text-[#E8ECF4]"
                }`}
              >
                {g}
              </button>
            ))}
          </div>
        </div>

        {/* Subject */}
        <div className="mb-8">
          <label className="block text-sm font-medium text-[#111827] dark:text-[#E8ECF4] mb-3">Mācību priekšmets</label>
          <select
            value={currentSubject}
            onChange={(e) => onSubjectChange(e.target.value)}
            className="w-full rounded-xl border border-[#E5E7EB] dark:border-white/7 bg-[#F1F5F9] dark:bg-[#1A2033] px-4 py-3.5 text-sm text-[#111827] dark:text-[#E8ECF4] focus:border-[#2563EB] dark:focus:border-[#4F8EF7] focus:outline-none focus:ring-1 focus:ring-[#2563EB] dark:focus:ring-[#4F8EF7] transition-all"
          >
            {SUBJECTS.map((s) => (
              <option key={s.value} value={s.value}>
                {s.label}
              </option>
            ))}
          </select>
        </div>

        {/* CTA - Solid blue, no gradient */}
        <button
          onClick={handleSave}
          disabled={loading}
          className="w-full flex items-center justify-center gap-2 rounded-xl bg-accent py-4 text-sm font-bold text-white shadow-sm transition-all hover:bg-accent-hover active:scale-[0.98] disabled:opacity-70 disabled:pointer-events-none"
        >
          {loading ? "Saglabā..." : "Sākt sarunu"}
          {!loading && (
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-5 h-5">
              <path fillRule="evenodd" d="M3 10a.75.75 0 0 1 .75-.75h10.638L10.23 5.29a.75.75 0 1 1 1.04-1.08l5.5 5.25a.75.75 0 0 1 0 1.08l-5.5 5.25a.75.75 0 1 1-1.04-1.08l4.158-3.96H3.75A.75.75 0 0 1 3 10Z" clipRule="evenodd" />
            </svg>
          )}
        </button>
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
      <div className={`${widthClass} h-10 rounded-2xl bg-[#F1F5F9] dark:bg-[#1A2033] animate-pulse`} />
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
// Exam countdown badge
// ---------------------------------------------------------------------------

function ExamCountdownBadge({
  daysRemaining,
  colorClass,
  label,
  tooltip,
}: {
  daysRemaining: number;
  colorClass: string;
  label: string;
  tooltip: string;
}) {
  return (
    <div
      title={tooltip}
      className={`flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-semibold cursor-default select-none ${colorClass}`}
    >
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="h-3 w-3 shrink-0">
        <path fillRule="evenodd" d="M10 18a8 8 0 1 0 0-16 8 8 0 0 0 0 16Zm.75-13a.75.75 0 0 0-1.5 0v5c0 .414.336.75.75.75h4a.75.75 0 0 0 0-1.5h-3.25V5Z" clipRule="evenodd" />
      </svg>
      <span>{label}: {daysRemaining}d</span>
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
      <div className="h-1.5 w-14 overflow-hidden rounded-full bg-[#E5E7EB] dark:bg-[#1A2033]">
        <div
          className={`h-full rounded-full transition-all ${color}`}
          style={{ width: `${Math.min(100, percent)}%` }}
        />
      </div>
      <span className="text-[11px] font-bold text-[#111827] dark:text-[#E8ECF4]">{percent}%</span>
    </div>
  );
}
