"use client";

import { useState } from "react";
import Link from "next/link";
import { useAuth } from "@/lib/context/auth-context";
import { getExamCountdown } from "@/lib/exams/latvianExams";

interface UpgradeModalProps {
  onClose: () => void;
  /** Optional grade — when 9 or 12, shows exam countdown badge */
  grade?: number | null;
}

const PLANS = [
  {
    id: "free" as const,
    name: "Bezmaksas",
    price: "€0",
    period: "/mēn.",
    features: [
      "Visi priekšmeti no 6.–12. klasei",
      "~3 jautājumi dienā (100 mēnesī)",
      "Atbildes pielāgotas Latvijas mācību programmai",
    ],
    accent: "muted",
    popular: false,
  },
  {
    id: "pro" as const,
    name: "Pro",
    price: "€5.99",
    period: "/mēn.",
    features: [
      "20 jautājumi dienā (800 mēnesī)",
      "Pilns skaidrojums ar risinājuma soļiem",
      "Ātrākas atbildes, bez gaidīšanas",
      "Pilns izglītības saturs visos priekšmetos",
    ],
    accent: "primary",
    popular: true,
  },
  {
    id: "premium" as const,
    name: "Eksāmenu Plāns",
    price: "€14.99",
    period: "/mēn.",
    features: [
      "Viss, kas Pro plānā, plus:",
      "Visprecīzākais AI modelis (augstākā atbilžu kvalitāte)",
      "Eksāmenu līmeņa uzdevumu ģenerēšana",
      "Detalizēta soļu-pa-soļim analīze",
      "50 jautājumi dienā — maksimāla sagatavošanās",
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
// Plan card
// ---------------------------------------------------------------------------

interface PlanCardProps {
  plan: (typeof PLANS)[number];
  isCurrentPlan: boolean;
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
  isCurrentPlan,
  consentPro,
  onConsentPro,
  consentPremium,
  onConsentPremium,
  loading,
  onCheckout,
  onClose,
  examCountdown,
}: PlanCardProps) {
  return (
    <div
      className={`relative flex flex-col rounded-2xl border p-6 lg:p-8 transition-all duration-300 ${
        plan.popular
          ? "border-transparent bg-gradient-to-b from-[#2563EB]/15 to-transparent dark:from-[#2563EB]/25 ring-2 ring-[#2563EB]/40 shadow-xl shadow-[#2563EB]/20 dark:shadow-[#2563EB]/20"
          : "border-[#D1D5DB] dark:border-white/7 bg-white dark:bg-[#1A2033]/50"
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
      <h3 className={`text-lg font-semibold ${plan.popular ? "text-[#2563EB] dark:text-[#4F8EF7]" : "text-[#111827] dark:text-[#E8ECF4]"}`}>
        {plan.name}
      </h3>
      {plan.id === "free" && isCurrentPlan && (
        <p className="mt-0.5 text-xs text-[#6B7280] dark:text-[#8B95A8]">Tavs pašreizējais plāns</p>
      )}

      {/* Price */}
      <div className="mt-3 flex items-baseline gap-1">
        <span className="text-3xl font-extrabold tracking-tight text-[#111827] dark:text-[#E8ECF4]">
          {plan.price}
        </span>
        <span className="text-sm font-medium text-[#6B7280] dark:text-[#8B95A8]">
          {plan.period}
        </span>
      </div>

      {/* CTA — directly below price */}
      {plan.id === "free" && (
        <button
          onClick={isCurrentPlan ? undefined : onClose}
          disabled={isCurrentPlan}
          className={`mt-4 w-full rounded-xl py-3 text-sm font-bold transition-all ${
            isCurrentPlan
              ? "bg-transparent border border-[#374151] text-[#6B7280] cursor-not-allowed opacity-60"
              : "bg-transparent border border-[#374151] text-[#6B7280] hover:border-[#6B7280] hover:bg-[#F1F5F9] dark:hover:bg-[#1A2033]"
          }`}
        >
          {isCurrentPlan ? "Tavs pašreizējais plāns" : "Sākt bez maksas"}
        </button>
      )}
      {plan.id === "pro" && (
        <button
          onClick={() => onCheckout("pro")}
          disabled={loading !== null || !consentPro}
          className="mt-4 w-full rounded-xl py-3 text-sm font-bold transition-all disabled:opacity-50 disabled:pointer-events-none flex items-center justify-center gap-2 bg-[#2563EB] text-white hover:bg-blue-700 shadow-lg shadow-[#2563EB]/30 hover:shadow-xl hover:-translate-y-0.5"
        >
          {loading === "pro" ? (
            <>
              <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
              Notiek pāradresēšana...
            </>
          ) : (
            "Sākt Pro — €5.99/mēn."
          )}
        </button>
      )}
      {plan.id === "premium" && (
        <button
          onClick={() => onCheckout("premium")}
          disabled={loading !== null || !consentPremium}
          className="mt-4 w-full rounded-xl py-3 text-sm font-bold transition-all disabled:opacity-50 disabled:pointer-events-none flex items-center justify-center gap-2 bg-[#F59E0B] text-[#111827] hover:bg-[#F59E0B]/90 shadow-md hover:shadow-lg hover:-translate-y-0.5"
        >
          {loading === "premium" ? (
            <>
              <span className="h-4 w-4 animate-spin rounded-full border-2 border-[#111827]/30 border-t-[#111827]" />
              Notiek pāradresēšana...
            </>
          ) : (
            "Sākt Eksāmenu Plānu — €14.99/mēn."
          )}
        </button>
      )}

      {/* Feature list — below CTA */}
      <ul className="mt-4 space-y-3">
        {plan.features.map((feature) => (
          <li
            key={feature}
            className="flex items-start gap-2.5 text-sm text-[#6B7280] dark:text-[#8B95A8] font-medium"
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

      {/* Consent + secondary CTA — pinned to bottom for paid plans */}
      {plan.id === "pro" && (
        <div className="mt-auto pt-5">
          <label className="flex items-start gap-2.5 cursor-pointer">
            <div className={`relative mt-0.5 shrink-0 ${!consentPro ? "animate-checkbox-nudge" : ""}`}>
              <input
                type="checkbox"
                checked={consentPro}
                onChange={(e) => onConsentPro(e.target.checked)}
                className="peer appearance-none h-4 w-4 rounded border-2 border-[#374151] checked:bg-[#2563EB] checked:border-[#2563EB] cursor-pointer transition-colors"
              />
              <svg
                className="pointer-events-none absolute inset-0 h-4 w-4 text-white opacity-0 peer-checked:opacity-100 transition-opacity"
                viewBox="0 0 16 16"
                fill="none"
              >
                <path d="M3 8.5l2.5 2.5 5.5-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </div>
            <span className="text-[11px] text-[#6B7280] dark:text-[#8B95A8] leading-relaxed">
              Piekrītu tūlītējai piekļuvei un saprotu, ka zaudēju 14 dienu atteikuma tiesības.
            </span>
          </label>
        </div>
      )}
      {plan.id === "premium" && (
        <div className="mt-auto pt-5">
          <label className="flex items-start gap-2.5 cursor-pointer">
            <div className={`relative mt-0.5 shrink-0 ${!consentPremium ? "animate-checkbox-nudge" : ""}`}>
              <input
                type="checkbox"
                checked={consentPremium}
                onChange={(e) => onConsentPremium(e.target.checked)}
                className="peer appearance-none h-4 w-4 rounded border-2 border-[#374151] checked:bg-[#2563EB] checked:border-[#2563EB] cursor-pointer transition-colors"
              />
              <svg
                className="pointer-events-none absolute inset-0 h-4 w-4 text-white opacity-0 peer-checked:opacity-100 transition-opacity"
                viewBox="0 0 16 16"
                fill="none"
              >
                <path d="M3 8.5l2.5 2.5 5.5-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </div>
            <span className="text-[11px] text-[#6B7280] dark:text-[#8B95A8] leading-relaxed">
              Piekrītu tūlītējai piekļuvei un saprotu, ka zaudēju 14 dienu atteikuma tiesības.
            </span>
          </label>
          {examCountdown !== null && (
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

  // EU distance selling — Consumer Rights Directive Art. 16(m).
  const [consentPro, setConsentPro] = useState(false);
  const [consentPremium, setConsentPremium] = useState(false);

  const examCountdown = grade != null ? getExamCountdown(grade) : null;
  const isExamGrade = examCountdown !== null;

  // Detect free tier: no active paid subscription
  const isFreeTier = !profile?.tier || profile.tier === "free";

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
        body: JSON.stringify({ plan, consentTimestamp }),
      });

      if (!res.ok) {
        throw new Error("Nevarēja izveidot maksājumu sesiju");
      }

      const data = (await res.json()) as { url: string };
      if (data.url) {
        window.location.href = data.url;
      }
    } catch (err) {
      console.error("Checkout error:", err);
      setLoading(null);
    }
  };

  const sharedCardProps = {
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
        <div className="mb-10 text-center">
          {isExamGrade && (
            <span className="mb-4 inline-block rounded-full bg-[#F59E0B]/15 px-3 py-1 text-xs font-semibold text-[#F59E0B]">
              Eksāmeni pēc {examCountdown.daysRemaining} dienām
            </span>
          )}
          <h1 className="text-3xl font-bold text-[#111827] dark:text-[#E8ECF4] sm:text-4xl">
            Izvēlies savu plānu
          </h1>
          <p className="mt-2 text-sm text-[#6B7280] dark:text-[#8B95A8]">
            Atcelšana jebkurā laikā.
          </p>
        </div>

        {/* Cards — single column on mobile, 3 columns on md+ */}
        <div className="w-full max-w-5xl">
          <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
            {PLANS.map((plan) => (
              <PlanCard
                key={plan.id}
                plan={plan}
                isCurrentPlan={plan.id === "free" && isFreeTier}
                {...sharedCardProps}
              />
            ))}
          </div>
        </div>

        {/* Footer */}
        <p className="mt-10 pb-8 text-center text-xs text-[#6B7280] dark:text-[#8B95A8] leading-relaxed">
          Droši maksājumi ar Stripe. Atcelšana jebkurā laikā.{" "}
          <Link href="/terms" className="underline hover:text-[#374151] dark:hover:text-[#8B95A8] ml-1">
            Lietošanas noteikumi
          </Link>
          .
        </p>
      </div>
    </div>
  );
}
