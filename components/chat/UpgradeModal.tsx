"use client";

import { useState } from "react";
import Link from "next/link";
import { useAuth } from "@/lib/context/auth-context";
import { getExamCountdown } from "@/lib/exams/latvianExams";

interface UpgradeModalProps {
  onClose: () => void;
  /** Optional grade — when 9 or 12, shows exam-specific copy instead of the generic header */
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

export function UpgradeModal({ onClose, grade }: UpgradeModalProps) {
  const { getIdToken } = useAuth();
  const [loading, setLoading] = useState<string | null>(null);

  // EU distance selling — Consumer Rights Directive Art. 16(m).
  // Per-plan consent: checked before checkout can proceed.
  const [consentPro, setConsentPro] = useState(false);
  const [consentPremium, setConsentPremium] = useState(false);

  const examCountdown = grade != null ? getExamCountdown(grade) : null;
  const isExamGrade = examCountdown !== null;

  const handleCheckout = async (plan: "pro" | "premium") => {
    const consent = plan === "pro" ? consentPro : consentPremium;
    if (!consent) return; // guard — buttons are also disabled
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

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="relative mx-4 w-full max-w-3xl animate-fade-up rounded-2xl border border-[#E5E7EB] dark:border-white/7 bg-[#F9FAFB] dark:bg-[#0F1117] p-6 sm:p-8">
        {/* Close button */}
        <button
          onClick={onClose}
          className="absolute right-4 top-4 rounded-lg p-1.5 text-[#6B7280] dark:text-[#8B95A8] transition-colors hover:bg-[#F1F5F9] dark:hover:bg-[#1A2033] hover:text-[#111827] dark:hover:text-[#E8ECF4]"
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

        {/* Header */}
        <div className="mb-6 text-center">
          {isExamGrade ? (
            <>
              <h2 className="text-2xl font-bold bg-gradient-to-r from-[#F59E0B] to-[#d97706] bg-clip-text text-transparent sm:text-3xl">
                Sagatavojies eksāmenam bez stresa
              </h2>
              <p className="mt-2 text-base text-[#6B7280] dark:text-[#8B95A8]">
                Tev ir{" "}
                <span className="font-semibold text-[#111827] dark:text-[#E8ECF4]">
                  {examCountdown.daysRemaining}
                </span>{" "}
                dienas līdz centralizētajiem eksāmeniem. Eksāmenu Plāns ietver
                eksāmenu simulācijas, soli pa solim risinājumus un neierobežotas sarunas.
              </p>
            </>
          ) : (
            <>
              <h2 className="text-2xl font-bold bg-gradient-to-r from-[#2563EB] to-[#10B981] bg-clip-text text-transparent sm:text-3xl">
                Uzlabo savu plānu
              </h2>
              <p className="mt-2 text-base text-[#6B7280] dark:text-[#8B95A8]">
                Izvēlies sev piemērotāko SkolnieksAI plānu
              </p>
            </>
          )}
        </div>

        {/* Plans */}
        <div className="grid gap-4 grid-cols-1 sm:grid-cols-3 items-start relative z-10">
          {PLANS.map((plan) => (
            <div
              key={plan.id}
              className={`relative flex flex-col rounded-2xl border px-5 py-6 transition-all duration-300 ${
                plan.popular
                  ? "border-transparent bg-gradient-to-b from-[#2563EB]/15 to-transparent dark:from-[#2563EB]/25 ring-2 ring-[#2563EB]/40 shadow-xl shadow-[#2563EB]/20 dark:shadow-[#2563EB]/20 sm:-translate-y-2 z-20"
                  : "border-[#D1D5DB] dark:border-white/7 bg-white dark:bg-[#1A2033]/50 sm:mt-2"
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

              <h3 className={`text-lg font-semibold ${plan.popular ? "text-[#2563EB] dark:text-[#4F8EF7]" : "text-[#111827] dark:text-[#E8ECF4]"}`}>
                {plan.name}
              </h3>

              <div className="mt-3 flex items-baseline gap-1">
                <span className="text-3xl font-extrabold tracking-tight text-[#111827] dark:text-[#E8ECF4]">
                  {plan.price}
                </span>
                <span className="text-sm font-medium text-[#6B7280] dark:text-[#8B95A8]">
                  {plan.period}
                </span>
              </div>

              <ul className="mt-5 flex-1 space-y-3">
                {plan.features.map((feature) => (
                  <li
                    key={feature}
                    className="flex items-start gap-2.5 text-sm text-[#6B7280] dark:text-[#8B95A8] font-medium"
                  >
                    <svg
                      className={`mt-0.5 h-4 w-4 shrink-0 ${
                        plan.popular ? "text-[#2563EB] dark:text-[#4F8EF7]" : "text-[#2563EB] dark:text-[#4F8EF7]"
                      }`}
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

              {/* Per-card CTA */}
              {plan.id === "free" && (
                <button
                  onClick={onClose}
                  className="mt-7 w-full rounded-xl py-3 text-sm font-bold transition-all bg-transparent text-[#6B7280] dark:text-[#8B95A8] border border-[#D1D5DB] dark:border-white/10 hover:bg-[#F1F5F9] dark:hover:bg-[#1A2033]"
                >
                  Sākt bez maksas
                </button>
              )}
              {plan.id === "pro" && (
                <>
                  {/* EU Consumer Rights Directive Art. 16(m) inline consent */}
                  <label className="mt-5 flex items-start gap-2.5 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={consentPro}
                      onChange={(e) => setConsentPro(e.target.checked)}
                      className="mt-0.5 h-4 w-4 shrink-0 rounded border-[#D1D5DB] dark:border-white/20 accent-[#2563EB]"
                    />
                    <span className="text-[11px] text-[#6B7280] dark:text-[#8B95A8] leading-relaxed">
                      Piekrītu tūlītējai piekļuvei un saprotu, ka zaudēju 14 dienu atteikuma tiesības.
                    </span>
                  </label>
                  <button
                    onClick={() => handleCheckout("pro")}
                    disabled={loading !== null || !consentPro}
                    className="mt-3 w-full rounded-xl py-3 text-sm font-bold transition-all disabled:opacity-50 disabled:pointer-events-none flex items-center justify-center gap-2 bg-[#2563EB] text-white hover:bg-blue-700 shadow-lg shadow-[#2563EB]/30 hover:shadow-xl hover:-translate-y-0.5"
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
                </>
              )}
              {plan.id === "premium" && (
                <>
                  {/* EU Consumer Rights Directive Art. 16(m) inline consent */}
                  <label className="mt-5 flex items-start gap-2.5 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={consentPremium}
                      onChange={(e) => setConsentPremium(e.target.checked)}
                      className="mt-0.5 h-4 w-4 shrink-0 rounded border-[#D1D5DB] dark:border-white/20 accent-[#2563EB]"
                    />
                    <span className="text-[11px] text-[#6B7280] dark:text-[#8B95A8] leading-relaxed">
                      Piekrītu tūlītējai piekļuvei un saprotu, ka zaudēju 14 dienu atteikuma tiesības.
                    </span>
                  </label>
                  <button
                    onClick={() => handleCheckout("premium")}
                    disabled={loading !== null || !consentPremium}
                    className="mt-3 w-full rounded-xl py-3 text-sm font-bold transition-all disabled:opacity-50 disabled:pointer-events-none flex items-center justify-center gap-2 bg-[#F59E0B] text-[#111827] hover:bg-[#F59E0B]/90 shadow-md hover:shadow-lg hover:-translate-y-0.5"
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
                  {examCountdown !== null && (
                    <p className="mt-2 text-center text-xs text-[#6B7280] dark:text-[#8B95A8]">
                      Līdz eksāmenam: {examCountdown.daysRemaining} dienas
                    </p>
                  )}
                </>
              )}
            </div>
          ))}
        </div>

        {/* Footer */}
        <p className="mt-5 text-center text-xs text-[#6B7280] dark:text-[#8B95A8] leading-relaxed">
          Droši maksājumi ar Stripe. Atcelšana jebkurā laikā.{" "}
          <Link href="/terms" className="underline hover:text-text-secondary ml-1">Lietošanas noteikumi</Link>.
        </p>
      </div>
    </div>
  );
}
