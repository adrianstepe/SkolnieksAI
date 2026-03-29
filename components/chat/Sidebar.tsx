"use client";

import { useState, useRef, useEffect } from "react";
import { Settings, Zap, LogOut } from "lucide-react";
import { LogoWordmark } from "@/components/LogoWordmark";
import { SUBJECTS } from "./SubjectGradeSelector";

export interface RecentChat {
  id: string;
  title: string;
  subject: string;
}

interface SidebarProps {
  activeSubject: string;
  onSubjectChange: (subject: string) => void;
  recentChats?: RecentChat[];
  activeChatId?: string | null;
  onChatSelect?: (chatId: string) => void;
  onChatDelete?: (chatId: string) => void;
  onNewChat?: () => void;
  mobileOpen?: boolean;
  onMobileClose?: () => void;
  userName?: string;
  userEmail?: string;
  userGrade?: number;
  collapsed?: boolean;
  onToggleCollapse?: () => void;
  onSettingsOpen?: () => void;
  onUpgradeOpen?: () => void;
  onSignOut?: () => void;
  isPremium?: boolean;
}

export function Sidebar({
  activeSubject,
  onSubjectChange,
  recentChats = [],
  activeChatId,
  onChatSelect,
  onChatDelete,
  onNewChat,
  mobileOpen = false,
  onMobileClose,
  userName,
  userEmail,
  userGrade,
  collapsed = false,
  onToggleCollapse,
  onSettingsOpen,
  onUpgradeOpen,
  onSignOut,
  isPremium = false,
}: SidebarProps) {
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);

  // Close menu on outside click
  useEffect(() => {
    if (!menuOpen) return;
    function handleClick(e: MouseEvent) {
      if (
        menuRef.current &&
        !menuRef.current.contains(e.target as Node) &&
        buttonRef.current &&
        !buttonRef.current.contains(e.target as Node)
      ) {
        setMenuOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [menuOpen]);

  const handleSubjectClick = (value: string) => {
    onSubjectChange(value);
    onMobileClose?.();
  };

  const initials = userName
    ? userName
        .split(" ")
        .map((n) => n[0])
        .join("")
        .toUpperCase()
        .slice(0, 2)
    : "U";

  return (
    <>
      {/* Mobile backdrop */}
      {mobileOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/50 lg:hidden"
          onClick={onMobileClose}
          aria-hidden="true"
        />
      )}

      <aside
        className={`fixed inset-y-0 left-0 z-50 flex flex-col bg-[#F9FAFB] dark:bg-[#0D1117] border-r border-gray-200 dark:border-none transition-all duration-300 ${
          collapsed ? "w-16" : "w-64"
        } ${
          mobileOpen ? "translate-x-0" : "-translate-x-full"
        } lg:translate-x-0 lg:z-30`}
      >
        {/* Logo + collapse */}
        <div className="flex items-center gap-3 px-4 h-14 border-b border-[#E5E7EB] dark:border-white/7">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg gradient-primary">
            <svg viewBox="0 0 24 24" fill="none" className="h-4 w-4">
              <path
                d="M12 2L14.5 9.5L22 12L14.5 14.5L12 22L9.5 14.5L2 12L9.5 9.5L12 2Z"
                fill="white"
              />
            </svg>
          </div>
          {!collapsed && <LogoWordmark size="sm" />}
          {/* Mobile close button — visible only on small screens */}
          <button
            onClick={onMobileClose}
            className="ml-auto rounded-md p-1 transition-colors hover:bg-[#D1D5DB] dark:hover:bg-[#1A2033] lg:hidden"
            aria-label="Aizvērt"
          >
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="h-5 w-5 text-[#374151] dark:text-[#8B95A8]">
              <path d="M6.28 5.22a.75.75 0 0 0-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 1 0 1.06 1.06L10 11.06l3.72 3.72a.75.75 0 1 0 1.06-1.06L11.06 10l3.72-3.72a.75.75 0 0 0-1.06-1.06L10 8.94 6.28 5.22Z" />
            </svg>
          </button>
          {/* Desktop collapse toggle */}
          <button
            onClick={onToggleCollapse}
            className="ml-auto rounded-md p-1 transition-colors hover:bg-[#D1D5DB] dark:hover:bg-[#1A2033] hidden lg:block"
            aria-label="Sakļaut"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 20 20"
              fill="currentColor"
              className={`h-4 w-4 text-[#374151] dark:text-[#8B95A8] transition-transform ${collapsed ? "rotate-180" : ""}`}
            >
              <path fillRule="evenodd" d="M11.78 5.22a.75.75 0 0 1 0 1.06L8.06 10l3.72 3.72a.75.75 0 1 1-1.06 1.06l-4.25-4.25a.75.75 0 0 1 0-1.06l4.25-4.25a.75.75 0 0 1 1.06 0Z" clipRule="evenodd" />
            </svg>
          </button>
        </div>

        {/* New chat button */}
        <div className="px-3 pt-3">
          <button
            onClick={() => {
              onNewChat?.();
              onMobileClose?.();
            }}
            className={`flex items-center gap-2 w-full rounded-lg border border-[#E5E7EB] dark:border-white/7 transition-colors hover:bg-[#E5E7EB] dark:hover:bg-[#1A2033]/50 ${
              collapsed ? "p-2 justify-center" : "px-3 py-2"
            }`}
          >
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4 text-[#2563EB] dark:text-[#4F8EF7]">
              <path d="M10.75 4.75a.75.75 0 0 0-1.5 0v4.5h-4.5a.75.75 0 0 0 0 1.5h4.5v4.5a.75.75 0 0 0 1.5 0v-4.5h4.5a.75.75 0 0 0 0-1.5h-4.5v-4.5Z" />
            </svg>
            {!collapsed && (
              <span className="text-sm font-semibold text-[#111827] dark:text-[#E8ECF4]">Jauna saruna</span>
            )}
          </button>
        </div>

        {/* Subjects */}
        <div className="flex-1 overflow-y-auto mt-3 px-3 thin-scrollbar">
          {!collapsed && (
            <p className="text-[11px] font-semibold uppercase tracking-wider text-[#111827] dark:text-[#E8ECF4] mb-2 px-1">
              Priekšmeti
            </p>
          )}
          <nav className="space-y-0.5">
            {SUBJECTS.map((s) => {
              const active = activeSubject === s.value;
              return (
                <button
                  key={s.value}
                  onClick={() => handleSubjectClick(s.value)}
                  className={`flex items-center font-medium gap-2.5 w-full rounded-lg transition-colors text-sm ${
                    collapsed ? "p-2 justify-center" : "px-3 py-2"
                  } ${
                    active
                      ? "bg-[#1D4ED8] dark:bg-[#3D7CE5] text-white"
                      : "text-[#111827] dark:text-[#E8ECF4] hover:bg-[#D1D5DB] dark:hover:bg-[#1A2033]/50"
                  }`}
                >
                  <s.icon className={`h-4 w-4 shrink-0 ${active ? "text-white" : "text-[#6B7280] dark:text-[#8B95A8]"}`} />
                  {!collapsed && <span>{s.shortLabel}</span>}
                </button>
              );
            })}
          </nav>

          {/* Recent chats */}
          {!collapsed && (
            <>
              <p className="text-[11px] font-semibold uppercase tracking-wider text-[#111827] dark:text-[#E8ECF4] mb-2 px-1 mt-6">
                Pēdējās sarunas
              </p>
              <div className="space-y-0.5">
                {recentChats.length > 0 ? (
                  recentChats.map((chat) => (
                    <div
                      key={chat.id}
                      className={`group flex items-center font-medium gap-2.5 w-full rounded-lg px-3 py-2 text-sm transition-colors ${
                        activeChatId === chat.id
                          ? "bg-[#1D4ED8] dark:bg-[#3D7CE5] text-white"
                          : "text-[#111827] dark:text-[#E8ECF4] hover:bg-[#D1D5DB] dark:hover:bg-[#1A2033]/50"
                      }`}
                    >
                      <button
                        onClick={() => {
                          onChatSelect?.(chat.id);
                          onMobileClose?.();
                        }}
                        className="flex items-center gap-2.5 flex-1 min-w-0 text-left"
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className={`h-3.5 w-3.5 shrink-0 ${activeChatId === chat.id ? "text-white/80" : "text-[#6B7280] dark:text-[#8B95A8]"}`}>
                          <path fillRule="evenodd" d="M10 2c-2.236 0-4.43.18-6.57.524C1.993 2.755 1 3.997 1 5.402v5.196c0 1.405.993 2.647 2.43 2.878a49.143 49.143 0 0 0 3.57.42V17.5a.75.75 0 0 0 1.234.577l3.733-3.154a49.38 49.38 0 0 0 2.603-.27c1.437-.23 2.43-1.472 2.43-2.878V5.402c0-1.405-.993-2.647-2.43-2.878A49.024 49.024 0 0 0 10 2Z" clipRule="evenodd" />
                        </svg>
                        <span className="truncate">{chat.title}</span>
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onChatDelete?.(chat.id);
                        }}
                        className="ml-auto shrink-0 rounded p-0.5 opacity-0 group-hover:opacity-100 transition-opacity hover:text-red-500"
                        aria-label="Dzēst sarunu"
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="h-3.5 w-3.5">
                          <path fillRule="evenodd" d="M8.75 1A2.75 2.75 0 0 0 6 3.75v.443c-.795.077-1.584.176-2.365.298a.75.75 0 1 0 .23 1.482l.149-.022.841 10.518A2.75 2.75 0 0 0 7.596 19h4.807a2.75 2.75 0 0 0 2.742-2.53l.841-10.52.149.023a.75.75 0 0 0 .23-1.482A41.03 41.03 0 0 0 14 4.193V3.75A2.75 2.75 0 0 0 11.25 1h-2.5ZM10 4c.84 0 1.673.025 2.5.075V3.75c0-.69-.56-1.25-1.25-1.25h-2.5c-.69 0-1.25.56-1.25 1.25v.325C8.327 4.025 9.16 4 10 4ZM8.58 7.72a.75.75 0 0 0-1.5.06l.3 7.5a.75.75 0 1 0 1.5-.06l-.3-7.5Zm4.34.06a.75.75 0 1 0-1.5-.06l-.3 7.5a.75.75 0 1 0 1.5.06l.3-7.5Z" clipRule="evenodd" />
                        </svg>
                      </button>
                    </div>
                  ))
                ) : (
                  <div className="flex flex-col items-center py-5 px-2 text-center">
                    <div className="mb-2.5 flex h-10 w-10 items-center justify-center rounded-xl bg-[#D1D5DB]/50 dark:bg-[#1A2033]/50">
                      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="h-5 w-5 text-[#374151] dark:text-[#8B95A8]">
                        <path fillRule="evenodd" d="M10 2c-2.236 0-4.43.18-6.57.524C1.993 2.755 1 3.997 1 5.402v5.196c0 1.405.993 2.647 2.43 2.878a49.143 49.143 0 0 0 3.57.42V17.5a.75.75 0 0 0 1.234.577l3.733-3.154a49.38 49.38 0 0 0 2.603-.27c1.437-.23 2.43-1.472 2.43-2.878V5.402c0-1.405-.993-2.647-2.43-2.878A49.024 49.024 0 0 0 10 2Z" clipRule="evenodd" />
                      </svg>
                    </div>
                    <p className="text-sm font-medium text-[#374151] dark:text-[#8B95A8]">Vēl nav sarunu</p>
                    <p className="mt-1 text-[11px] text-[#374151]/70 dark:text-[#8B95A8]/70">Uzdod pirmo jautājumu, lai sāktu</p>
                  </div>
                )}
              </div>
            </>
          )}
        </div>

        {/* User profile at bottom */}
        <div className="border-t border-[#E5E7EB] dark:border-white/7 px-3 py-3 relative">
          {/* Popup menu — renders above the button */}
          {menuOpen && (
            <div
              ref={menuRef}
              className="absolute bottom-full left-3 right-3 mb-2 rounded-xl border border-[#D1D5DB] dark:border-white/7 bg-white dark:bg-[#0D1117] shadow-lg overflow-hidden z-50"
            >
              {/* Email header */}
              <div className="px-4 py-3 border-b border-[#D1D5DB] dark:border-white/7">
                <p className="text-xs text-[#374151] dark:text-[#8B95A8] truncate">
                  {userEmail ?? userName ?? "Lietotājs"}
                </p>
              </div>

              <div className="py-1">
                <button
                  onClick={() => { setMenuOpen(false); onSettingsOpen?.(); }}
                  className="flex w-full items-center gap-3 px-4 py-2.5 text-sm text-[#111827] dark:text-[#E8ECF4] hover:bg-[#D1D5DB] dark:hover:bg-[#1A2033]/50 transition-colors"
                >
                  <Settings className="h-4 w-4 text-[#374151] dark:text-[#8B95A8]" />
                  Iestatījumi
                </button>

                {!isPremium && (
                  <button
                    onClick={() => { setMenuOpen(false); onUpgradeOpen?.(); }}
                    className="flex w-full items-center gap-3 px-4 py-2.5 text-sm text-accent font-medium hover:bg-accent/10 transition-colors"
                  >
                    <Zap className="h-4 w-4 text-accent" />
                    Uzlabot plānu
                  </button>
                )}
              </div>

              <div className="border-t border-[#D1D5DB] dark:border-white/7 py-1">
                <button
                  onClick={() => { setMenuOpen(false); onSignOut?.(); }}
                  className="flex w-full items-center gap-3 px-4 py-2.5 text-sm text-[#111827] dark:text-[#E8ECF4] hover:bg-[#D1D5DB] dark:hover:bg-[#1A2033]/50 transition-colors"
                >
                  <LogOut className="h-4 w-4 text-[#374151] dark:text-[#8B95A8]" />
                  Izrakstīties
                </button>
              </div>
            </div>
          )}

          <button
            ref={buttonRef}
            onClick={() => setMenuOpen((v) => !v)}
            className={`flex items-center gap-2 w-full rounded-lg px-2 py-1.5 transition-colors hover:bg-[#D1D5DB] dark:hover:bg-[#1A2033]/50 ${collapsed ? "justify-center" : ""}`}
          >
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#D1D5DB] dark:bg-[#1A2033]">
              <span className="text-xs font-medium text-[#111827] dark:text-[#E8ECF4]">{initials}</span>
            </div>
            {!collapsed && (
              <div className="min-w-0 flex-1 text-left">
                <p className="text-sm font-medium text-[#111827] dark:text-[#E8ECF4] truncate">
                  {userName ?? "Lietotājs"}
                </p>
                {userGrade && (
                  <p className="text-[11px] text-[#374151] dark:text-[#8B95A8]">
                    {userGrade}. klase
                  </p>
                )}
              </div>
            )}
            {!collapsed && (
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4 shrink-0 text-[#374151] dark:text-[#8B95A8]">
                <path fillRule="evenodd" d="M10 3a.75.75 0 0 1 .55.24l3.25 3.5a.75.75 0 1 1-1.1 1.02L10 4.852 7.3 7.76a.75.75 0 0 1-1.1-1.02l3.25-3.5A.75.75 0 0 1 10 3Zm-3.76 9.2a.75.75 0 0 1 1.06.04l2.7 2.908 2.7-2.908a.75.75 0 1 1 1.1 1.02l-3.25 3.5a.75.75 0 0 1-1.1 0l-3.25-3.5a.75.75 0 0 1 .04-1.06Z" clipRule="evenodd" />
              </svg>
            )}
          </button>
        </div>
      </aside>
    </>
  );
}
