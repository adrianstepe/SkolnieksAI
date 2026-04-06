"use client";

import { useState, useEffect, useRef } from "react";
import { useAuth } from "@/lib/context/auth-context";

// ---------------------------------------------------------------------------
// Milestone config
// ---------------------------------------------------------------------------

const MILESTONES = [7, 30, 100] as const;
type Milestone = (typeof MILESTONES)[number];

interface MilestoneConfig {
  icon: string;
  title: string;
  subtitle: string;
  colorHex: string;
  ringColorClass: string;
  bgClass: string;
  textClass: string;
}

const MILESTONE_CONFIG: Record<Milestone, MilestoneConfig> = {
  7: {
    icon: "⚡",
    title: "7 dienu sērija!",
    subtitle: "Izcili! Tu mācies katru dienu veselu nedēļu.",
    colorHex: "#4F8EF7",
    ringColorClass: "ring-[#4F8EF7]/40",
    bgClass: "bg-[#4F8EF7]/10 dark:bg-[#4F8EF7]/15",
    textClass: "text-[#1D4ED8] dark:text-[#4F8EF7]",
  },
  30: {
    icon: "🌟",
    title: "30 dienu sērija!",
    subtitle: "Vesels mēnesis! Tavs centīgums ir apbrīnojams.",
    colorHex: "#F59E0B",
    ringColorClass: "ring-[#F59E0B]/40",
    bgClass: "bg-[#F59E0B]/10 dark:bg-[#F59E0B]/15",
    textClass: "text-[#D97706] dark:text-[#F59E0B]",
  },
  100: {
    icon: "🏆",
    title: "100 dienu sērija!",
    subtitle: "Simts dienas! Tu esi īsts mācīšanās čempions.",
    colorHex: "#10B981",
    ringColorClass: "ring-[#10B981]/40",
    bgClass: "bg-[#10B981]/10 dark:bg-[#10B981]/15",
    textClass: "text-[#059669] dark:text-[#10B981]",
  },
};

// ---------------------------------------------------------------------------
// Session-storage key to avoid re-showing within the same session
// ---------------------------------------------------------------------------

function sessionKey(milestone: Milestone) {
  return `milestone-shown-${milestone}`;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

/**
 * Renders a fixed-position toast when the user's streak reaches a milestone
 * (7, 30, or 100 days). Detects the transition on first profile load and
 * auto-dismisses after 5 s. Uses sessionStorage to show at most once per
 * browser session per milestone.
 */
export function MilestoneCelebration() {
  const { profile } = useAuth();
  const [activeMilestone, setActiveMilestone] = useState<Milestone | null>(null);
  const [leaving, setLeaving] = useState(false);
  const profileLoadedRef = useRef(false);

  useEffect(() => {
    // Only fire on first profile load
    if (!profile || profileLoadedRef.current) return;
    profileLoadedRef.current = true;

    const streak = profile.currentStreak;
    const hit = MILESTONES.find(
      (m) => streak === m && !sessionStorage.getItem(sessionKey(m)),
    );

    if (hit) {
      sessionStorage.setItem(sessionKey(hit), "true");
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setActiveMilestone(hit);
    }
  }, [profile]);

  function dismiss() {
    setLeaving(true);
    // Remove from DOM after CSS transition completes (~300 ms)
    setTimeout(() => {
      setActiveMilestone(null);
      setLeaving(false);
    }, 300);
  }

  // Auto-dismiss after 5 s
  useEffect(() => {
    if (!activeMilestone) return;
    const timer = setTimeout(() => dismiss(), 5000);
    return () => clearTimeout(timer);
  }, [activeMilestone, dismiss]);

  if (!activeMilestone) return null;

  const cfg = MILESTONE_CONFIG[activeMilestone];

  return (
    <div
      role="status"
      aria-live="polite"
      aria-label={cfg.title}
      className={`fixed top-20 left-1/2 z-[60] -translate-x-1/2 px-4 transition-all duration-300 ${
        leaving ? "opacity-0 -translate-y-2" : "opacity-100 translate-y-0 animate-fade-up"
      }`}
    >
      <div
        className={`
          flex items-start gap-3.5 rounded-2xl border px-5 py-4
          shadow-2xl ring-2 backdrop-blur-md
          bg-white dark:bg-[#0F1117]
          border-[#E5E7EB] dark:border-white/10
          ${cfg.ringColorClass}
          max-w-sm w-full
        `}
        style={{ boxShadow: `0 8px 32px ${cfg.colorHex}30, 0 2px 8px rgba(0,0,0,0.2)` }}
      >
        {/* Icon badge */}
        <div
          className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-xl ${cfg.bgClass}`}
          aria-hidden="true"
        >
          {cfg.icon}
        </div>

        {/* Text */}
        <div className="flex-1 min-w-0">
          <p className={`text-sm font-bold ${cfg.textClass}`}>
            {cfg.title}
          </p>
          <p className="mt-0.5 text-xs text-[#6B7280] dark:text-[#8B95A8] leading-relaxed">
            {cfg.subtitle}
          </p>

          {/* Milestone dots */}
          <div className="mt-2.5 flex items-center gap-1.5">
            {MILESTONES.map((m) => (
              <div
                key={m}
                className={`h-1.5 rounded-full transition-all ${
                  m <= activeMilestone
                    ? `w-5 ${cfg.bgClass}`
                    : "w-3 bg-[#E5E7EB] dark:bg-[#1A2033]"
                }`}
                style={m <= activeMilestone ? { backgroundColor: `${cfg.colorHex}50` } : {}}
                aria-hidden="true"
              />
            ))}
            <span className="ml-1 text-[10px] font-semibold text-[#9CA3AF] dark:text-[#5A6478] tabular-nums">
              {activeMilestone === 100 ? "🎯 MAX" : `${activeMilestone}/100`}
            </span>
          </div>
        </div>

        {/* Dismiss */}
        <button
          onClick={dismiss}
          aria-label="Aizvērt paziņojumu"
          className="shrink-0 rounded-lg p-1 text-[#9CA3AF] dark:text-[#5A6478] transition-colors hover:text-[#374151] dark:hover:text-[#E8ECF4] hover:bg-[#F3F4F6] dark:hover:bg-[#1A2033]"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 20 20"
            fill="currentColor"
            className="h-4 w-4"
          >
            <path d="M6.28 5.22a.75.75 0 0 0-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 1 0 1.06 1.06L10 11.06l3.72 3.72a.75.75 0 1 0 1.06-1.06L11.06 10l3.72-3.72a.75.75 0 0 0-1.06-1.06L10 8.94 6.28 5.22Z" />
          </svg>
        </button>
      </div>
    </div>
  );
}
