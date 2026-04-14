"use client";

import { useState } from "react";
import Link from "next/link";
import { useAuth } from "@/lib/context/auth-context";
import type { UserTier } from "@/lib/context/auth-context";
import { logCheckoutStarted } from "@/lib/analytics/revenue";
import { getExamCountdown } from "@/lib/exams/latvianExams";

const TIER_RANK: Record<string, number> = { free: 0, pro: 1, premium: 2, school_pro: 3 };

interface UpgradeModalProps {
  onClose: () => void;
  /** Optional grade — when 9 or 12, shows exam countdown badge */
  grade?: number | null;
}

type Interval = "monthly" | "annual";

const PLANS = [
  {
    id: "free" as const,
    name: "Bezmaksas",
    monthly: { price: "€0", period: "/mēn." },
    annual: { price: "€0", period: "/mēn." },
    features: [
      "Visi priekšmeti no 6.–12. klasei",
      "15 jautājumi dienā (60 mēnesī)",
      "Atbildes pielāgotas Latvijas mācību programmai",
    ],
    accent: "muted",
    popular: false,
  },
  {
    id: "pro" as const,
    name: "Pro",
    monthly: { price: "€5.99", period: "/mēn." },
    annual: { price: "€59.99", period: "/gadā", monthlyEquiv: "€4.99/mēn." },
    features: [
      "40 jautājumi dienā",
      "Pilns skaidrojums ar risinājuma soļiem",
      "Ātrākas atbildes, bez gaidīšanas",
      "Pilns izglītības saturs visos priekšmetos",
    ],
    accent: "primary",
    popular: true,
  },
  {
    id: "premium" as const,
    name: "Premium",
    monthly: { price: "€14.99", period: "/mēn." },
    annual: { price: "€143.99", period: "/gadā", monthlyEquiv: "€11.99/mēn." },
    features: [
      "Viss, kas Pro plānā, plus:",
      "Visprecīzākais AI modelis (augstākā atbilžu kvalitāte)",
      "Eksāmenu līmeņa uzdevumu ģenerēšana",
      "Detalizēta soļu-pa-soļim analīze",
      "80 jautājumi dienā — maksimāla sagatavošanās",
    ],
    accent: "accent",
    popular: false,
  },
];

/** Renders a feature string, converting **bold** segments to <strong>. */
function FeatureText({ text }: { text: string }) {
  const parts = text.split(/(\*\*[^*]+\*\*)/g);
  return (
    <>
      {parts.map((part, i) =>
        part.startsWith("**") && part.endsWith("**") ? (
          <strong key={i} className="font-semibold text-[#111827] dark:text-[#E8ECF4]">
            {part.slice(2, -2)}
          </strong>
        ) : (
          <span key={i}>{part}</span>
        )
      )}
    </>
  );
}

// ---------------------------------------------------------------------------
// Interval toggle
// ---------------------------------------------------------------------------

function IntervalToggle({
  interval,
  onChange,
}: {
  interval: Interval;
  onChange: (v: Interval) => void;
}) {
  return (
    <div className="flex justify-center mb-8">
      <div className="relative grid grid-cols-2 items-center rounded-full bg-[#F3F4F6] dark:bg-[#1A2033] border border-[#E5E7EB] dark:border-white/7 p-1 w-72">
        <div
          className="absolute top-1 bottom-1 rounded-full bg-[#2563EB] transition-all duration-300 ease-out"
          style={{
            left: interval === "monthly" ? "4px" : "calc(50%)",
            width: "calc(50% - 4px)",
          }}
        />
        <button
          onClick={() => onChange("monthly")}
          className={`relative z-10 flex items-center justify-center rounded-full py-1.5 text-sm font-semibold transition-colors duration-200 ${
            interval === "monthly"
              ? "text-white"
              : "text-[#6B7280] dark:text-[#8B95A8] hover:text-[#374151] dark:hover:text-[#E8ECF4]"
          }`}
        >
          Mēneša
        </button>
        <button
          onClick={() => onChange("annual")}
          className={`relative z-10 flex items-center justify-center gap-1.5 rounded-full py-1.5 text-sm font-semibold transition-colors duration-200 ${
            interval === "annual"
              ? "text-white"
              : "text-[#6B7280] dark:text-[#8B95A8] hover:text-[#374151] dark:hover:text-[#E8ECF4]"
          }`}
        >
          Gada
          <span className="rounded-full bg-emerald-500/20 px-1.5 py-0.5 text-[10px] font-bold text-emerald-500 dark:text-emerald-400 whitespace-nowrap">
            -2 mēn.
          </span>
        </button>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Plan card
// ---------------------------------------------------------------------------

interface PlanCardProps {
  plan: (typeof PLANS)[number];
  interval: Interval;
  currentTier: UserTier;
  consentPro: boolean;
  onConsentPro: (v: boolean) => void;
  consentPremium: boolean;
  onConsentPremium: (v: boolean) => void;
  loading: string | null;
  onCheckout: (plan: "pro" | "premium") => void;
  onClose: () => void;
  examCountdown: ReturnType<typeof getExamCountdown>;
}

function PlanCard({
  plan,
  interval,
  currentTier,
  consentPro,
  onConsentPro,
  consentPremium,
  onConsentPremium,
  loading,
  onCheckout,
  onClose,
  examCountdown,
}: PlanCardProps) {
  const [showWarning, setShowWarning] = useState(false);

  const isCurrentPlan = plan.id === currentTier || (plan.id === "free" && currentTier === "free");
  const isDowngrade =
    !isCurrentPlan &&
    (TIER_RANK[plan.id] ?? 0) < (TIER_RANK[currentTier] ?? 0);
  const ctaState: "current" | "downgrade" | "upgrade" =
    isCurrentPlan ? "current" : isDowngrade ? "downgrade" : "upgrade";

  function triggerWarning() {
    setShowWarning(true);
    setTimeout(() => setShowWarning(false), 600);
  }

  const consent = plan.id === "pro" ? consentPro : consentPremium;
  const pricing = plan[interval];
  const monthlyEquiv = "monthlyEquiv" in pricing ? pricing.monthlyEquiv : null;

  const ctaLabel =
    plan.id === "pro"
      ? interval === "monthly"
        ? "Sākt Pro — €5.99/mēn."
        : "Sākt Pro — €59.99/gadā"
      : plan.id === "premium"
        ? interval === "monthly"
          ? "Sākt Premium — €14.99/mēn."
          : "Sākt Premium — €143.99/gadā"
        : "";

  return (
    <div
      className={`relative flex flex-col rounded-2xl p-6 lg:p-8 transition-all duration-300 ${
        plan.popular
          ? "border-2 border-[#2563EB] bg-gradient-to-b from-[#EFF6FF] to-white shadow-xl shadow-[#2563EB]/20 dark:from-[#1E2A45] dark:to-[#141C33] dark:shadow-[#2563EB]/20"
          : "border border-[#E5E7EB] shadow-md bg-white dark:border-white/7 dark:bg-[#1A2033]/50"
      }`}
    >
      {plan.popular && (
        <div className="absolute -top-3 left-0 right-0 flex justify-center">
          <span className="rounded-full bg-gradient-to-r from-[#2563EB] to-[#1d4ed8] px-4 py-1 text-[11px] font-bold uppercase tracking-widest text-white shadow-lg shadow-[#2563EB]/30 whitespace-nowrap flex items-center gap-1.5">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-3.5 h-3.5">
              <path fillRule="evenodd" d="M10.868 2.884c-.321-.772-1.415-.772-1.736 0l-1.83 4.401-4.753.381c-.833.067-1.171 1.107-.536 1.651l3.62 3.102-1.106 4.637c-.194.813.691 1.456 1.405 1.02L10 15.591l4.069 2.485c.713.436 1.598-.207 1.404-1.02l-1.106-4.637 3.62-3.102c.635-.544.297-1.584-.536-1.65l-4.752-.382-1.831-4.401z" clipRule="evenodd" />
            </svg>
            Populārākais
          </span>
        </div>
      )}

      {/* Plan name */}
      <h3
        className={`text-lg font-semibold ${
          plan.popular ? "text-[#1D4ED8] dark:text-[#93C5FD]" : "text-[#111827] dark:text-[#E8ECF4]"
        }`}
      >
        {plan.name}
      </h3>
      {isCurrentPlan && (
        <p className="mt-0.5 text-xs text-[#6B7280] dark:text-[#8B95A8]">Tavs pašreizējais plāns</p>
      )}

      {/* Price */}
      <div className="mt-3 flex items-baseline gap-1">
        <span
          className={`text-3xl font-extrabold tracking-tight ${
            plan.popular ? "text-[#111827] dark:text-white" : "text-[#111827] dark:text-[#E8ECF4]"
          }`}
        >
          {pricing.price}
        </span>
        <span
          className={`text-sm font-medium ${
            plan.popular ? "text-[#4B5563] dark:text-[#9CA3AF]" : "text-[#6B7280] dark:text-[#8B95A8]"
          }`}
        >
          {pricing.period}
        </span>
      </div>

      {/* Effective monthly cost for annual */}
      {monthlyEquiv ? (
        <p className="mt-1 text-sm font-medium text-emerald-600 dark:text-emerald-400">
          {monthlyEquiv}
        </p>
      ) : (
        <div className="mt-1 h-5" />
      )}

      {/* CTA — directly below price */}
      {plan.id === "free" && (
        <button
          onClick={ctaState === "upgrade" ? onClose : undefined}
          disabled={ctaState !== "upgrade"}
          className={`mt-4 w-full rounded-xl py-3 text-sm font-bold transition-all ${
            ctaState === "upgrade"
              ? "bg-transparent border border-[#374151] text-[#6B7280] hover:border-[#6B7280] hover:bg-[#F1F5F9] dark:hover:bg-[#1A2033]"
              : "bg-transparent border border-[#2D3748] text-[#4B5563] dark:text-[#6B7280] cursor-not-allowed opacity-50 select-none"
          }`}
        >
          {ctaState === "current" ? "Tavs pašreizējais plāns" : "Bezmaksas plāns"}
        </button>
      )}
      {plan.id === "pro" && (
        <div className="relative mt-4">
          {ctaState === "upgrade" && showWarning && (
            <div className="absolute -top-8 left-0 right-0 flex justify-center pointer-events-none z-10">
              <span className="rounded-md border border-orange-300 bg-white px-2.5 py-1 text-[11px] font-semibold text-orange-800 shadow-md dark:border-[#374151] dark:bg-[#1A2033] dark:text-[#FBBF24]">
                Vispirms apstipriniet zemāk
              </span>
            </div>
          )}
          {ctaState === "upgrade" ? (
            <button
              onClick={() => { if (!consentPro) { triggerWarning(); return; } onCheckout("pro"); }}
              disabled={loading !== null}
              className={`w-full rounded-xl py-3 text-sm font-bold transition-all disabled:opacity-50 disabled:pointer-events-none flex items-center justify-center gap-2 bg-[#2563EB] text-white hover:bg-blue-700 shadow-lg shadow-[#2563EB]/30 hover:shadow-xl hover:-translate-y-0.5 ${!consentPro ? "opacity-50" : ""}`}
            >
              {loading === "pro" ? (
                <>
                  <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                  Notiek pāradresēšana...
                </>
              ) : (
                ctaLabel
              )}
            </button>
          ) : (
            <button
              disabled
              className="w-full rounded-xl py-3 text-sm font-bold bg-transparent border border-[#2D3748] text-[#4B5563] dark:text-[#6B7280] cursor-not-allowed opacity-50 select-none"
            >
              {ctaState === "current" ? "Tavs pašreizējais plāns" : "Pro plāns"}
            </button>
          )}
        </div>
      )}
      {plan.id === "premium" && (
        <div className="relative mt-4">
          {ctaState === "upgrade" && showWarning && (
            <div className="absolute -top-8 left-0 right-0 flex justify-center pointer-events-none z-10">
              <span className="rounded-md border border-orange-300 bg-white px-2.5 py-1 text-[11px] font-semibold text-orange-800 shadow-md dark:border-[#374151] dark:bg-[#1A2033] dark:text-[#FBBF24]">
                Vispirms apstipriniet zemāk
              </span>
            </div>
          )}
          {ctaState === "upgrade" ? (
            <button
              onClick={() => { if (!consentPremium) { triggerWarning(); return; } onCheckout("premium"); }}
              disabled={loading !== null}
              className={`w-full rounded-xl py-3 text-sm font-bold transition-all disabled:opacity-50 disabled:pointer-events-none flex items-center justify-center gap-2 bg-[#F59E0B] text-[#111827] hover:bg-[#F59E0B]/90 shadow-md hover:shadow-lg hover:-translate-y-0.5 ${!consentPremium ? "opacity-50" : ""}`}
            >
              {loading === "premium" ? (
                <>
                  <span className="h-4 w-4 animate-spin rounded-full border-2 border-[#111827]/30 border-t-[#111827]" />
                  Notiek pāradresēšana...
                </>
              ) : (
                ctaLabel
              )}
            </button>
          ) : (
            <button
              disabled
              className="w-full rounded-xl py-3 text-sm font-bold bg-transparent border border-[#2D3748] text-[#4B5563] dark:text-[#6B7280] cursor-not-allowed opacity-50 select-none"
            >
              {ctaState === "current" ? "Tavs pašreizējais plāns" : "Premium plāns"}
            </button>
          )}
        </div>
      )}

      {/* Feature list — below CTA */}
      <ul className="mt-4 space-y-3">
        {plan.features.map((feature) => (
          <li
            key={feature}
            className={`flex items-start gap-2.5 text-sm font-medium ${
              plan.popular ? "text-[#374151] dark:text-[#E5E7EB]" : "text-[#6B7280] dark:text-[#8B95A8]"
            }`}
          >
            <svg
              className="mt-0.5 h-4 w-4 shrink-0 text-[#2563EB] dark:text-[#4F8EF7]"
              fill="currentColor"
              viewBox="0 0 20 20"
            >
              <path
                fillRule="evenodd"
                d="M16.704 4.153a.75.75 0 0 1 .143 1.052l-8 10.5a.75.75 0 0 1-1.127.075l-4.5-4.5a.75.75 0 0 1 1.06-1.06l3.894 3.893 7.48-9.817a.75.75 0 0 1 1.05-.143Z"
                clipRule="evenodd"
              />
            </svg>
            <FeatureText text={feature} />
          </li>
        ))}
      </ul>

      {/* Consent — only shown when upgrading to this plan */}
      {(plan.id === "pro" || plan.id === "premium") && ctaState === "upgrade" && (
        <div className="mt-auto pt-5">
          <label
            className={`flex items-start gap-2.5 cursor-pointer transition-all duration-150 ${
              showWarning ? "translate-x-1" : "translate-x-0"
            }`}
          >
            <div className="relative mt-0.5 shrink-0">
              <input
                type="checkbox"
                checked={consent}
                onChange={(e) =>
                  plan.id === "pro"
                    ? onConsentPro(e.target.checked)
                    : onConsentPremium(e.target.checked)
                }
                className={`peer h-4 w-4 shrink-0 cursor-pointer appearance-none rounded border-2 bg-[#F3F4F6] transition-colors duration-150 checked:border-[#2563EB] checked:bg-[#2563EB] checked:ring-0 dark:bg-[#1A2033] dark:checked:bg-[#2563EB] ${
                  showWarning && !consent
                    ? "border-orange-500 ring-2 ring-orange-400/60 dark:border-[#F59E0B] dark:ring-orange-500/40"
                    : "border-[#6B7280] ring-1 ring-black/[0.06] dark:border-[#9CA3AF] dark:ring-white/10"
                }`}
              />
              <svg
                className="pointer-events-none absolute inset-0 h-4 w-4 text-white opacity-0 peer-checked:opacity-100 transition-opacity"
                viewBox="0 0 16 16"
                fill="none"
              >
                <path d="M3 8.5l2.5 2.5 5.5-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </div>
            <span
              className={`text-[11px] leading-relaxed ${
                plan.popular ? "text-[#6B7280] dark:text-[#9CA3AF]" : "text-[#9CA3AF]"
              }`}
            >
              {!consent && (
                <span
                  className={`mr-1.5 mt-[3px] inline-block h-2 w-2 shrink-0 rounded-full bg-orange-500 dark:bg-[#F59E0B] ${
                    showWarning ? "ring-2 ring-orange-400 shadow-sm dark:ring-amber-300/80" : "ring-1 ring-orange-700/30 dark:ring-amber-500/40"
                  }`}
                  aria-hidden
                />
              )}
              Piekrītu tūlītējai piekļuvei un saprotu, ka zaudēju 14 dienu atteikuma tiesības.
            </span>
          </label>
          {plan.id === "premium" && examCountdown !== null && (
            <p className="mt-2 text-center text-xs text-[#6B7280] dark:text-[#8B95A8]">
              Līdz eksāmenam: {examCountdown.daysRemaining} dienas
            </p>
          )}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Full-screen pricing page
// ---------------------------------------------------------------------------

export function UpgradeModal({ onClose, grade }: UpgradeModalProps) {
  const { getIdToken, profile } = useAuth();
  const [loading, setLoading] = useState<string | null>(null);
  const [interval, setInterval] = useState<Interval>("annual");

  // EU distance selling — Consumer Rights Directive Art. 16(m).
  const [consentPro, setConsentPro] = useState(false);
  const [consentPremium, setConsentPremium] = useState(false);

  const examCountdown = grade != null ? getExamCountdown(grade) : null;
  const isExamGrade = examCountdown !== null;

  const currentTier: UserTier = profile?.tier ?? "free";

  const handleCheckout = async (plan: "pro" | "premium") => {
    const consent = plan === "pro" ? consentPro : consentPremium;
    if (!consent) return;
    setLoading(plan);
    try {
      const token = await getIdToken();
      if (!token) return;

      const consentTimestamp = new Date().toISOString();

      const res = await fetch("/api/stripe/checkout", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ plan, interval, consentTimestamp }),
      });

      if (!res.ok) {
        throw new Error("Nevarēja izveidot maksājumu sesiju");
      }

      const data = (await res.json()) as { url: string };
      if (data.url) {
        await logCheckoutStarted({
          plan,
          interval,
          source: "upgrade_modal",
        });
        window.location.href = data.url;
      }
    } catch (err) {
      console.error("Checkout error:", err);
      setLoading(null);
    }
  };

  const sharedCardProps = {
    interval,
    currentTier,
    consentPro,
    onConsentPro: setConsentPro,
    consentPremium,
    onConsentPremium: setConsentPremium,
    loading,
    onCheckout: handleCheckout,
    onClose,
    examCountdown,
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-[#F9FAFB] dark:bg-[#0F1117]">
      {/* Close button */}
      <button
        onClick={onClose}
        className="fixed right-4 top-4 z-10 rounded-lg p-1.5 text-[#6B7280] dark:text-[#8B95A8] transition-colors hover:bg-[#F1F5F9] dark:hover:bg-[#1A2033] hover:text-[#111827] dark:hover:text-[#E8ECF4]"
        aria-label="Aizvērt"
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

      {/* Centred content column */}
      <div className="flex min-h-full flex-col items-center justify-center px-4 py-16 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="mb-6 text-center">
          {isExamGrade && (
            <span className="mb-4 inline-block rounded-full bg-[#F59E0B]/15 px-3 py-1 text-xs font-semibold text-[#F59E0B]">
              Eksāmeni pēc {examCountdown.daysRemaining} dienām
            </span>
          )}
          <h1 className="text-3xl font-bold text-[#111827] dark:text-[#E8ECF4] sm:text-4xl">
            Izvēlies savu plānu
          </h1>
        </div>

        {/* Interval toggle */}
        <IntervalToggle interval={interval} onChange={setInterval} />

        {/* Cards — single column on mobile, 3 columns on md+ */}
        <div className="w-full max-w-5xl">
          <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
            {PLANS.map((plan) => (
              <PlanCard
                key={plan.id}
                plan={plan}
                {...sharedCardProps}
              />
            ))}
          </div>
        </div>

        {/* Footer */}
        <p className="mt-10 pb-8 text-center text-xs text-[#6B7280] dark:text-[#8B95A8] leading-relaxed">
          Droši maksājumi ar Stripe. ·{" "}
          <Link href="/terms" className="underline hover:text-[#374151] dark:hover:text-[#8B95A8]">
            Lietošanas noteikumi
          </Link>
        </p>
      </div>
    </div>
  );
}
