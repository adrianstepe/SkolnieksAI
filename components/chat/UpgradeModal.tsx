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
      "Ierobežots jautājumu skaits (~60/mēn.)",
      "Standarta palīgs",
      "Visi priekšmeti, ierobežots jautājumu skaits",
    ],
    accent: "muted",
  },
  {
    id: "pro" as const,
    name: "Pro",
    price: "€5.99",
    period: "/mēn.",
    features: [
      "Vairāk jautājumu mēnesī",
      "Pilns palīgs",
      "Prioritāra atbilde",
      "Pilns izglītības saturs",
    ],
    accent: "primary",
  },
  {
    id: "premium" as const,
    name: "Premium",
    price: "€14.99",
    period: "/mēn.",
    features: [
      "**Claude Sonnet 4.6** (Augstākā precizitāte)",
      "Eksāmenu līmeņa uzdevumu ģenerēšana",
      "Detalizēta soļu-pa-solim analīze",
      "Pielāgots Latvijas izglītības standartiem",
    ],
    accent: "accent",
    popular: true,
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

  const examCountdown = grade != null ? getExamCountdown(grade) : null;
  const isExamGrade = examCountdown !== null;

  const handleCheckout = async (plan: "pro" | "premium") => {
    setLoading(plan);
    try {
      const token = await getIdToken();
      if (!token) return;

      const res = await fetch("/api/stripe/checkout", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ plan }),
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
      <div className="relative mx-4 w-full max-w-3xl animate-fade-up rounded-2xl border border-[#E5E7EB] dark:border-white/7 bg-[#F9FAFB] dark:bg-[#0F1117] p-6 sm:p-8 max-h-[90vh] overflow-y-auto hide-scrollbar">
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
              <h2 className="text-2xl font-bold bg-gradient-to-r from-[#10B981] to-[#059669] bg-clip-text text-transparent sm:text-3xl">
                Sagatavojies eksāmenam bez stresa
              </h2>
              <p className="mt-2 text-base text-[#6B7280] dark:text-[#8B95A8]">
                Tev ir{" "}
                <span className="font-semibold text-[#111827] dark:text-[#E8ECF4]">
                  {examCountdown.daysRemaining}
                </span>{" "}
                dienas līdz centralizētajiem eksāmeniem. Premium ietver eksāmenu
                simulācijas, soli pa solim risinājumus un neierobežotas sarunas.
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

        {/* Social proof */}
        <div className="mb-8 flex items-center justify-center gap-2">
          <div className="flex -space-x-2">
            {["A", "M", "K"].map((l) => (
              <div key={l} className="flex h-7 w-7 items-center justify-center rounded-full bg-[#F1F5F9] dark:bg-[#1A2033] border-2 border-[#F9FAFB] dark:border-[#0F1117] text-[10px] font-semibold text-[#6B7280] dark:text-[#8B95A8]">
                {l}
              </div>
            ))}
          </div>
          <p className="text-sm text-[#6B7280] dark:text-[#8B95A8]">
            Jau <span className="font-semibold text-[#111827] dark:text-[#E8ECF4]">2 400+</span> skolēni mācās ar SkolnieksAI Premium
          </p>
        </div>

        {/* Plans */}
        <div className="grid gap-4 grid-cols-1 sm:grid-cols-3 items-start relative z-10">
          {PLANS.map((plan) => (
            <div
              key={plan.id}
              className={`relative flex flex-col rounded-2xl border px-5 py-6 transition-all duration-300 ${
                plan.popular
                  ? "border-transparent bg-gradient-to-b from-[#10B981]/15 to-transparent dark:from-[#10B981]/25 ring-2 ring-[#10B981] shadow-xl shadow-[#10B981]/20 dark:shadow-[#10B981]/10 sm:-translate-y-2 z-20"
                  : "border-[#D1D5DB] dark:border-white/7 bg-white dark:bg-[#1A2033]/50 sm:mt-2"
              }`}
            >
              {plan.popular && (
                <div className="absolute -top-3 left-0 right-0 flex justify-center">
                  <span className="rounded-full bg-gradient-to-r from-[#10B981] to-[#059669] px-4 py-1 text-[11px] font-bold uppercase tracking-widest text-white shadow-lg whitespace-nowrap flex items-center gap-1.5">
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-3.5 h-3.5">
                      <path fillRule="evenodd" d="M10.868 2.884c-.321-.772-1.415-.772-1.736 0l-1.83 4.401-4.753.381c-.833.067-1.171 1.107-.536 1.651l3.62 3.102-1.106 4.637c-.194.813.691 1.456 1.405 1.02L10 15.591l4.069 2.485c.713.436 1.598-.207 1.404-1.02l-1.106-4.637 3.62-3.102c.635-.544.297-1.584-.536-1.65l-4.752-.382-1.831-4.401z" clipRule="evenodd" />
                    </svg>
                    Populārākais
                  </span>
                </div>
              )}

              <h3 className={`text-lg font-semibold ${plan.popular ? "text-[#059669] dark:text-[#34D399]" : "text-[#111827] dark:text-[#E8ECF4]"}`}>
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
                        plan.popular ? "text-[#10B981] dark:text-[#34D399]" : "text-[#2563EB] dark:text-[#4F8EF7]"
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

              {/* Individual card CTA only for Free tier */}
              {plan.id === "free" && (
                <button
                  disabled
                  className="mt-7 w-full rounded-xl py-3 text-sm font-bold disabled:opacity-50 bg-[#F1F5F9] dark:bg-[#1A2033] text-[#6B7280] dark:text-[#8B95A8] border border-[#E5E7EB] dark:border-white/7"
                >
                  Pašreizējais plāns
                </button>
              )}
            </div>
          ))}
        </div>

        {/* Side-by-side CTA row for paid plans */}
        <div className="mt-6 grid grid-cols-1 sm:grid-cols-2 gap-3">
          {/* Pro CTA */}
          <div className="flex flex-col items-center gap-1.5">
            <button
              onClick={() => handleCheckout("pro")}
              disabled={loading !== null}
              className="w-full rounded-xl py-3 text-sm font-bold transition-all disabled:opacity-50 flex items-center justify-center gap-2 bg-blue-600 text-white hover:bg-blue-700 shadow-md hover:shadow-xl hover:-translate-y-0.5"
            >
              {loading === "pro" ? (
                <>
                  <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                  Notiek pāradresēšana...
                </>
              ) : (
                "Izvēlēties Pro — €4.99/mēn"
              )}
            </button>
            <p className="text-[11px] text-[#6B7280] dark:text-[#8B95A8]">
              (Neierobežoti jautājumi, prioritāra atbilde)
            </p>
          </div>

          {/* Premium CTA */}
          <div className="flex flex-col items-center gap-1.5">
            <button
              onClick={() => handleCheckout("premium")}
              disabled={loading !== null}
              className="w-full rounded-xl py-3 text-sm font-bold transition-all disabled:opacity-50 flex items-center justify-center gap-2 bg-emerald-500 text-white hover:bg-emerald-600 shadow-lg shadow-emerald-500/25 hover:shadow-xl hover:-translate-y-0.5"
            >
              {loading === "premium" ? (
                <>
                  <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                  Notiek pāradresēšana...
                </>
              ) : (
                <>
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4">
                    <path fillRule="evenodd" d="M10.868 2.884c-.321-.772-1.415-.772-1.736 0l-1.83 4.401-4.753.381c-.833.067-1.171 1.107-.536 1.651l3.62 3.102-1.106 4.637c-.194.813.691 1.456 1.405 1.02L10 15.591l4.069 2.485c.713.436 1.598-.207 1.404-1.02l-1.106-4.637 3.62-3.102c.635-.544.297-1.584-.536-1.65l-4.752-.382-1.831-4.401z" clipRule="evenodd" />
                  </svg>
                  {isExamGrade ? "Sākt Premium — €14.99/mēn" : "Izvēlēties Premium — €14.99/mēn"}
                </>
              )}
            </button>
            <p className="text-[11px] text-[#6B7280] dark:text-[#8B95A8]">
              Claude Sonnet 4.6 · Eksāmenu simulācijas
            </p>
          </div>
        </div>

        {/* Footer */}
        <p className="mt-5 text-center text-xs text-[#6B7280] dark:text-[#8B95A8] leading-relaxed">
          Droši maksājumi caur Stripe. Atcelšana jebkurā laikā.{" "}
          <Link href="/terms" className="underline hover:text-text-secondary ml-1">Lietošanas noteikumi</Link>.
        </p>
      </div>
    </div>
  );
}
