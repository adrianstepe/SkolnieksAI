"use client";

import { useState } from "react";
import { useAuth } from "@/lib/context/auth-context";

/**
 * Compact streak badge shown in the chat header.
 * Displays the flame icon, current streak count, and an ice badge if a freeze
 * is active. Clicking opens a small popover with more streak details.
 */
export function StreakIndicator() {
  const { profile } = useAuth();
  const [open, setOpen] = useState(false);

  if (!profile || profile.currentStreak === 0) return null;

  const { currentStreak, longestStreak, streakFreeze } = profile;

  return (
    <div className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        aria-label={`Mācību sērija: ${currentStreak} dienas. Nospied, lai uzzinātu vairāk.`}
        className="flex items-center gap-1.5 rounded-lg px-2.5 py-1 bg-[#F59E0B]/10 dark:bg-[#F59E0B]/15 border border-[#F59E0B]/25 dark:border-[#F59E0B]/30 transition-colors hover:bg-[#F59E0B]/20 dark:hover:bg-[#F59E0B]/25 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#F59E0B]/50"
      >
        {/* Flame icon */}
        <svg
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 20 20"
          fill="currentColor"
          className="h-4 w-4 text-[#F59E0B] shrink-0"
          aria-hidden="true"
        >
          <path
            fillRule="evenodd"
            d="M13.5 4.938a7 7 0 1 1-7.84 11.357A4.5 4.5 0 0 0 10 11.25a.75.75 0 0 1 0-1.5 3 3 0 0 0 .574-5.938 5.524 5.524 0 0 1-1.035 2.796.75.75 0 0 1-1.277-.54V5.25a.75.75 0 0 1 .75-.75h.013c.11 0 .218.013.322.038a7.018 7.018 0 0 1 4.153.4Z"
            clipRule="evenodd"
          />
        </svg>

        {/* Count */}
        <span className="text-sm font-bold text-[#F59E0B] tabular-nums leading-none">
          {currentStreak}
        </span>

        {/* Freeze badge */}
        {streakFreeze && (
          <span
            aria-label="Sērijas aizsardzība aktīva"
            className="flex h-4 w-4 items-center justify-center rounded-full bg-[#60A5FA]/20 border border-[#60A5FA]/30"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 20 20"
              fill="currentColor"
              className="h-2.5 w-2.5 text-[#60A5FA]"
              aria-hidden="true"
            >
              <path d="M10 2a.75.75 0 0 1 .75.75v.536l.416-.24a.75.75 0 0 1 .75 1.3l-.416.24.416.24a.75.75 0 0 1-.75 1.3l-.416-.24v.482a.75.75 0 0 1-1.5 0v-.482l-.416.24a.75.75 0 1 1-.75-1.3l.416-.24-.416-.24a.75.75 0 0 1 .75-1.3l.416.24V2.75A.75.75 0 0 1 10 2Zm-3.34 3.927a.75.75 0 0 1-.427.97l-.496.18.496.18a.75.75 0 0 1-.544 1.396l-.496-.18v.527a.75.75 0 0 1-1.5 0V8.473l-.496.18a.75.75 0 1 1-.544-1.396l.496-.18-.496-.18a.75.75 0 0 1 .544-1.396l.496.18V5.154a.75.75 0 0 1 1.5 0v.527l.496-.18a.75.75 0 0 1 .975.426Zm6.68 0a.75.75 0 0 1 .975-.426l.496.18v-.527a.75.75 0 0 1 1.5 0v.527l.496-.18a.75.75 0 1 1 .544 1.396l-.496.18.496.18a.75.75 0 0 1-.544 1.396l-.496-.18v.527a.75.75 0 0 1-1.5 0V8.473l-.496.18a.75.75 0 0 1-.544-1.396l.496-.18-.496-.18a.75.75 0 0 1-.43-.97ZM10 9.25a.75.75 0 0 1 .75.75v.482l.416-.24a.75.75 0 0 1 .75 1.3l-.416.24.416.24a.75.75 0 0 1-.75 1.299l-.416-.239V13.6a.75.75 0 0 1-1.5 0v-.518l-.416.24a.75.75 0 1 1-.75-1.299l.416-.24-.416-.24a.75.75 0 0 1 .75-1.3l.416.24V10a.75.75 0 0 1 .75-.75Z" />
            </svg>
          </span>
        )}
      </button>

      {/* Popover */}
      {open && (
        <>
          {/* Click-away overlay */}
          <div
            className="fixed inset-0 z-30"
            onClick={() => setOpen(false)}
            aria-hidden="true"
          />

          <div className="absolute right-0 top-full z-40 mt-2 w-52 animate-fade-up rounded-xl border border-[#E5E7EB] dark:border-white/7 bg-white dark:bg-[#1A2033] p-4 shadow-xl">
            {/* Streak count */}
            <div className="flex items-center gap-2 mb-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-[#F59E0B]/15">
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  viewBox="0 0 20 20"
                  fill="currentColor"
                  className="h-5 w-5 text-[#F59E0B]"
                  aria-hidden="true"
                >
                  <path
                    fillRule="evenodd"
                    d="M13.5 4.938a7 7 0 1 1-7.84 11.357A4.5 4.5 0 0 0 10 11.25a.75.75 0 0 1 0-1.5 3 3 0 0 0 .574-5.938 5.524 5.524 0 0 1-1.035 2.796.75.75 0 0 1-1.277-.54V5.25a.75.75 0 0 1 .75-.75h.013c.11 0 .218.013.322.038a7.018 7.018 0 0 1 4.153.4Z"
                    clipRule="evenodd"
                  />
                </svg>
              </div>
              <div>
                <p className="text-base font-bold text-[#111827] dark:text-[#E8ECF4] tabular-nums leading-tight">
                  {currentStreak} {currentStreak === 1 ? "diena" : currentStreak < 5 ? "dienas" : "dienu"}
                </p>
                <p className="text-xs text-[#6B7280] dark:text-[#8B95A8]">pašreizējā sērija</p>
              </div>
            </div>

            {/* Longest streak */}
            <div className="flex items-center justify-between rounded-lg bg-[#F3F4F6] dark:bg-[#0F1117] px-3 py-2 mb-2">
              <span className="text-xs text-[#6B7280] dark:text-[#8B95A8]">Labākā sērija</span>
              <span className="text-xs font-bold text-[#111827] dark:text-[#E8ECF4] tabular-nums">
                {longestStreak} {longestStreak === 1 ? "diena" : longestStreak < 5 ? "dienas" : "dienu"}
              </span>
            </div>

            {/* Freeze status */}
            {streakFreeze ? (
              <div className="flex items-center gap-2 rounded-lg bg-[#60A5FA]/10 border border-[#60A5FA]/20 px-3 py-2">
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  viewBox="0 0 20 20"
                  fill="currentColor"
                  className="h-3.5 w-3.5 shrink-0 text-[#60A5FA]"
                  aria-hidden="true"
                >
                  <path d="M10 2a.75.75 0 0 1 .75.75v.536l.416-.24a.75.75 0 0 1 .75 1.3l-.416.24.416.24a.75.75 0 0 1-.75 1.3l-.416-.24v.482a.75.75 0 0 1-1.5 0v-.482l-.416.24a.75.75 0 1 1-.75-1.3l.416-.24-.416-.24a.75.75 0 0 1 .75-1.3l.416.24V2.75A.75.75 0 0 1 10 2Z" />
                </svg>
                <span className="text-xs font-medium text-[#60A5FA]">
                  Aizsardzība aktīva
                </span>
              </div>
            ) : (
              <p className="text-[11px] text-[#9CA3AF] dark:text-[#5A6478] text-center leading-relaxed">
                Piesakies katru dienu, lai saglabātu sēriju!
              </p>
            )}
          </div>
        </>
      )}
    </div>
  );
}
