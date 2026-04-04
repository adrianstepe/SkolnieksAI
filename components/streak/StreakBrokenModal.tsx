"use client";

import { useState } from "react";
import { useAuth } from "@/lib/context/auth-context";
import { logCheckoutStarted } from "@/lib/analytics/revenue";

interface StreakBrokenModalProps {
  /** The streak count that was lost (shown for emotional context). */
  lostStreak: number;
  onClose: () => void;
}

const CHECK_ICON = (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    viewBox="0 0 20 20"
    fill="currentColor"
    className="h-4 w-4 shrink-0 text-[#10B981]"
    aria-hidden="true"
  >
    <path
      fillRule="evenodd"
      d="M16.704 4.153a.75.75 0 0 1 .143 1.052l-8 10.5a.75.75 0 0 1-1.127.075l-4.5-4.5a.75.75 0 0 1 1.06-1.06l3.894 3.893 7.48-9.817a.75.75 0 0 1 1.05-.143Z"
      clipRule="evenodd"
    />
  </svg>
);

const FEATURES = [
  "Sērijas atjaunošana nekavējoties",
  "2 Sērijas aizsardzības katru mēnesi",
  "Vairāk jautājumu mēnesī",
  "Pilns izglītības saturs",
];

/**
 * Loss-aversion modal shown when a user's streak has just been broken.
 * Offers a direct path to the Premium checkout (€5.99/month) which includes
 * streak repair and two monthly streak freezes.
 *
 * Rendering decision lives in ChatContainer — this component is pure UI.
 */
export function StreakBrokenModal({ lostStreak, onClose }: StreakBrokenModalProps) {
  const { getIdToken } = useAuth();
  const [loading, setLoading] = useState(false);
  const [checkoutError, setCheckoutError] = useState(false);

  const handleCheckout = async () => {
    setLoading(true);
    setCheckoutError(false);
    try {
      const token = await getIdToken();
      if (!token) throw new Error("no_token");

      const res = await fetch("/api/stripe/checkout", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          plan: "pro",
          consentTimestamp: new Date().toISOString(),
        }),
      });

      if (!res.ok) throw new Error("checkout_failed");

      const data = (await res.json()) as { url: string };
      if (data.url) {
        await logCheckoutStarted({ plan: "pro", source: "streak_broken_modal" });
        window.location.href = data.url;
      }
    } catch {
      setCheckoutError(true);
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/70 backdrop-blur-sm"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Sheet / modal — slides up on mobile, centered on sm+ */}
      <div className="relative w-full sm:mx-4 sm:max-w-sm animate-slide-up sm:animate-fade-up rounded-t-2xl sm:rounded-2xl border border-[#E5E7EB] dark:border-white/7 bg-[#F9FAFB] dark:bg-[#0F1117] px-6 pt-6 pb-8 sm:p-8">
        {/* Close */}
        <button
          onClick={onClose}
          aria-label="Aizvērt"
          className="absolute right-4 top-4 rounded-lg p-1.5 text-[#6B7280] dark:text-[#8B95A8] transition-colors hover:bg-[#F1F5F9] dark:hover:bg-[#1A2033] hover:text-[#111827] dark:hover:text-[#E8ECF4]"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 20 20"
            fill="currentColor"
            className="h-5 w-5"
          >
            <path d="M6.28 5.22a.75.75 0 0 0-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 1 0 1.06 1.06L10 11.06l3.72 3.72a.75.75 0 1 0 1.06-1.06L11.06 10l3.72-3.72a.75.75 0 0 0-1.06-1.06L10 8.94 6.28 5.22Z" />
          </svg>
        </button>

        {/* Drag handle — visible on mobile only */}
        <div className="mx-auto mb-5 h-1 w-10 rounded-full bg-[#D1D5DB] dark:bg-[#1A2033] sm:hidden" aria-hidden="true" />

        {/* Hero — broken streak visual */}
        <div className="mb-6 text-center">
          <div className="mb-3 flex items-center justify-center gap-1">
            {/* Greyed-out broken flame */}
            <span
              className="text-4xl grayscale opacity-40"
              aria-hidden="true"
            >
              🔥
            </span>
            {/* Crack indicator */}
            <span className="text-2xl" aria-hidden="true">💔</span>
          </div>

          <h2 className="text-xl font-bold text-[#111827] dark:text-[#E8ECF4]">
            Tava sērija pārtrūka
          </h2>

          {lostStreak > 1 && (
            <p className="mt-1 text-sm font-medium text-[#F59E0B]">
              {lostStreak} dienu sērija zaudēta
            </p>
          )}

          <p className="mt-2 text-sm text-[#6B7280] dark:text-[#8B95A8] leading-relaxed">
            Neatkāpies — tu vari to atgūt! Turpini no tur, kur apstājies.
          </p>
        </div>

        {/* Upgrade card */}
        <div className="mb-5 rounded-xl border border-[#F59E0B]/30 bg-gradient-to-b from-[#F59E0B]/8 to-transparent dark:from-[#F59E0B]/12 p-4">
          <div className="mb-3 flex items-baseline gap-1.5">
            <span className="text-2xl font-extrabold tracking-tight text-[#111827] dark:text-[#E8ECF4]">
              €5.99
            </span>
            <span className="text-sm text-[#6B7280] dark:text-[#8B95A8]">/mēn.</span>
            <span className="ml-auto rounded-full bg-[#10B981]/15 px-2.5 py-0.5 text-[11px] font-bold uppercase tracking-wide text-[#059669] dark:text-[#10B981]">
              Premium
            </span>
          </div>

          <ul className="space-y-2">
            {FEATURES.map((feature) => (
              <li
                key={feature}
                className="flex items-start gap-2.5 text-sm text-[#374151] dark:text-[#8B95A8]"
              >
                {CHECK_ICON}
                {feature}
              </li>
            ))}
          </ul>
        </div>

        {/* CTA */}
        <button
          onClick={handleCheckout}
          disabled={loading}
          className="w-full rounded-xl py-3.5 text-sm font-bold transition-all disabled:opacity-60 flex items-center justify-center gap-2 bg-gradient-to-r from-[#F59E0B] to-[#D97706] text-white shadow-lg shadow-[#F59E0B]/25 hover:from-[#D97706] hover:to-[#B45309] hover:shadow-xl hover:-translate-y-0.5 active:translate-y-0"
        >
          {loading ? (
            <>
              <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" aria-hidden="true" />
              Notiek pāradresēšana...
            </>
          ) : (
            "Atjaunot sēriju par €5.99/mēn."
          )}
        </button>

        {checkoutError && (
          <p className="mt-2 text-center text-xs text-red-500 dark:text-red-400">
            Nevarēja sākt maksājumu. Lūdzu, mēģini vēlreiz.
          </p>
        )}

        {/* Secondary dismiss */}
        <button
          onClick={onClose}
          className="mt-3 w-full py-2 text-sm text-[#6B7280] dark:text-[#8B95A8] transition-colors hover:text-[#374151] dark:hover:text-[#E8ECF4]"
        >
          Varbūt vēlāk
        </button>

        {/* Trust line */}
        <p className="mt-3 text-center text-[11px] text-[#9CA3AF] dark:text-[#5A6478] leading-relaxed">
          Droši maksājumi caur Stripe · Atcelšana jebkurā laikā
        </p>
      </div>
    </div>
  );
}
