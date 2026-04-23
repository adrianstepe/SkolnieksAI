"use client";

import { useState } from "react";
import Link from "next/link";
import { Check } from "lucide-react";
import { LATVIAN_EXAM_DATES_2026 } from "@/lib/exams/latvianExams";

type Interval = "monthly" | "annual";

/** Subtext under the CTA: `null` = none; per-interval string or `"countdown"` placeholder. */
type PlanCtaSub = null | Record<Interval, string | "countdown" | null>;

type PlanRow = {
  id: "free" | "pro" | "exam";
  name: string;
  monthly: string;
  annual: string;
  annualMonthly?: string;
  features: readonly string[];
  cta: Record<Interval, string>;
  ctaStyle: "outline" | "primary" | "accent";
  badge: null | "popular" | "exam";
  ctaSub: PlanCtaSub;
};

const PLANS: readonly PlanRow[] = [
  {
    id: "free" as const,
    name: "Bezmaksas",
    monthly: "€0",
    annual: "€0",
    features: [
      "Visi priekšmeti no 6.–12. klasei",
      "15 jautājumi dienā (60 mēnesī)",
      "Atbildes pielāgotas Latvijas skolas kursam",
    ],
    cta: { monthly: "Sākt bez maksas", annual: "Sākt bez maksas" },
    ctaStyle: "outline",
    badge: null,
    ctaSub: null,
  },
  {
    id: "pro" as const,
    name: "Pro",
    monthly: "€5.99",
    annual: "€59.99",
    annualMonthly: "€4.99",
    features: [
      "40 jautājumi dienā",
      "Pilns skaidrojums ar risinājuma soļiem",
      "Ātrākas atbildes, bez gaidīšanas",
      "Pilns izglītības saturs visos priekšmetos",
    ],
    cta: {
      monthly: "Sākt Pro — €5.99/mēn.",
      annual: "Sākt Pro — €59.99/gadā",
    },
    ctaStyle: "primary",
    badge: "popular",
    ctaSub: { monthly: "Atcelšana jebkurā brīdī.", annual: null },
  },
  {
    id: "exam" as const,
    name: "Premium",
    monthly: "€14.99",
    annual: "€143.99",
    annualMonthly: "€11.99",
    features: [
      "Visprecīzākais AI modelis (augstākā atbilžu kvalitāte)",
      "Eksāmenu līmeņa uzdevumu ģenerēšana",
      "Detalizēta soļu-pa-soļim analīze",
      "80 jautājumi dienā — maksimāla sagatavošanās",
    ],
    cta: {
      monthly: "Sākt Premium — €14.99/mēn.",
      annual: "Sākt Premium — €143.99/gadā",
    },
    ctaStyle: "accent",
    badge: "exam",
    ctaSub: { monthly: "countdown" as const, annual: "countdown" as const },
  },
];

function getDaysToExam(): number | null {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const nearestFuture = LATVIAN_EXAM_DATES_2026.find((d) => d >= today);
  if (!nearestFuture) return null;
  return Math.ceil(
    (nearestFuture.getTime() - today.getTime()) / (1000 * 60 * 60 * 24),
  );
}

function IntervalToggle({
  interval,
  onChange,
}: {
  interval: Interval;
  onChange: (v: Interval) => void;
}) {
  return (
    <div className="flex justify-center mb-12">
      <div className="relative grid grid-cols-2 items-center rounded-full bg-surface border border-border p-1 w-72">
        {/* Animated pill background */}
        <div
          className="absolute top-1 bottom-1 rounded-full bg-primary transition-all duration-300 ease-out"
          style={{
            left: interval === "monthly" ? "4px" : "calc(50%)",
            width: "calc(50% - 4px)",
          }}
        />
        <button
          onClick={() => onChange("monthly")}
          className={`relative z-10 flex items-center justify-center rounded-full py-2 text-sm font-semibold transition-colors duration-200 ${
            interval === "monthly"
              ? "text-white"
              : "text-white/60 hover:text-white/80"
          }`}
        >
          Mēneša
        </button>
        <button
          onClick={() => onChange("annual")}
          className={`relative z-10 flex items-center justify-center gap-1.5 rounded-full py-2 text-sm font-semibold transition-colors duration-200 ${
            interval === "annual"
              ? "text-white"
              : "text-white/60 hover:text-white/80"
          }`}
        >
          Gada
          <span className="rounded-full bg-emerald-500/20 px-1.5 py-0.5 text-[9px] font-bold text-emerald-400 leading-none">
            −2 mēn.
          </span>
        </button>
      </div>
    </div>
  );
}

export function Pricing() {
  const [interval, setInterval] = useState<Interval>("annual");
  const daysToExam = getDaysToExam();

  return (
    <section className="py-24 max-w-7xl mx-auto px-6">
      <h2 className="text-3xl md:text-5xl font-heading font-bold text-center text-white mb-4">
        Sagatavojies eksāmeniem bez stresa
      </h2>
      <p className="text-center text-white/70 text-lg mb-16 max-w-2xl mx-auto">
        {daysToExam !== null ? (
          <>
            Līdz centralizētajiem eksāmeniem ir{" "}
            <span className="font-semibold text-white">{daysToExam}</span>{" "}
            dienas.{" "}
          </>
        ) : null}
        Izvēlies plānu, kas palīdzēs tev saprast, nevis tikai iegaumēt.
      </p>

      <IntervalToggle interval={interval} onChange={setInterval} />

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-center">
        {PLANS.map((plan) => {
          const isPopular = plan.badge === "popular";
          const isExam = plan.badge === "exam";
          const price = interval === "monthly" ? plan.monthly : plan.annual;
          const periodLabel = interval === "monthly" ? "/mēn." : "/gadā";
          const ctaText = plan.cta[interval];
          const rawCtaSub =
            plan.ctaSub === null ? null : plan.ctaSub[interval];
          const ctaSub =
            rawCtaSub === "countdown"
              ? daysToExam !== null
                ? `Līdz eksāmenam: ${daysToExam} dienas`
                : null
              : rawCtaSub;

          return (
            <div
              key={plan.id}
              style={
                isPopular
                  ? {
                      background:
                        "linear-gradient(to bottom, rgba(79,142,247,0.12) 0%, rgba(26,32,51,0.97) 45%, #1A2033 100%)",
                    }
                  : undefined
              }
              className={[
                "relative flex flex-col rounded-3xl border transition-all duration-300",
                isPopular
                  ? [
                      "border-primary/60 ring-2 ring-primary shadow-2xl shadow-primary/20",
                      "scale-105 z-10 py-10 px-8",
                      "hover:-translate-y-2",
                    ].join(" ")
                  : [
                      "bg-surface border-border p-8",
                      "hover:-translate-y-2 hover:shadow-2xl",
                    ].join(" "),
              ].join(" ")}
            >
              {/* Badge */}
              {isPopular && (
                <div className="absolute -top-4 left-0 right-0 flex justify-center">
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-gradient-to-r from-primary to-primary-hover px-4 py-1 text-[11px] font-bold uppercase tracking-widest text-white shadow-lg">
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      viewBox="0 0 20 20"
                      fill="currentColor"
                      className="w-3.5 h-3.5"
                    >
                      <path
                        fillRule="evenodd"
                        d="M10.868 2.884c-.321-.772-1.415-.772-1.736 0l-1.83 4.401-4.753.381c-.833.067-1.171 1.107-.536 1.651l3.62 3.102-1.106 4.637c-.194.813.691 1.456 1.405 1.02L10 15.591l4.069 2.485c.713.436 1.598-.207 1.404-1.02l-1.106-4.637 3.62-3.102c.635-.544.297-1.584-.536-1.65l-4.752-.382-1.831-4.401z"
                        clipRule="evenodd"
                      />
                    </svg>
                    Populārākais
                  </span>
                </div>
              )}
              {isExam && (
                <div className="absolute -top-4 left-0 right-0 flex justify-center">
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-[#F59E0B] px-4 py-1 text-[11px] font-bold uppercase tracking-widest text-[#111827] shadow-lg shadow-[#F59E0B]/40">
                    Eksāmenu Tops
                  </span>
                </div>
              )}

              <h3
                className={[
                  "text-xl font-bold mb-2",
                  isPopular ? "text-primary" : "text-white",
                ].join(" ")}
              >
                {plan.name}
              </h3>

              <div className="flex items-baseline gap-1 mb-2">
                <span className="text-4xl font-bold text-white">
                  {price}
                </span>
                <span className="text-white/60">
                  {plan.id === "free" ? "/mēn." : periodLabel}
                </span>
              </div>

              {/* Effective monthly cost for annual plans */}
              {interval === "annual" && "annualMonthly" in plan && plan.annualMonthly && (
                <p className="text-sm text-emerald-400 font-medium mb-6">
                  {plan.annualMonthly}/mēn.
                </p>
              )}
              {(interval === "monthly" || !("annualMonthly" in plan) || !plan.annualMonthly) && (
                <div className="mb-6" />
              )}

              <ul className="space-y-4 mb-10 flex-grow">
                {plan.features.map((f, i) => (
                  <li
                    key={i}
                    className="flex items-start gap-3 text-sm text-white/80"
                  >
                    <Check
                      size={16}
                      className={`${isPopular ? "text-primary" : "text-emerald-400"} shrink-0 mt-0.5`}
                    />
                    {f}
                  </li>
                ))}
              </ul>

              <Link
                href="/signup"
                className={[
                  "w-full py-4 rounded-xl font-bold transition-all text-center block",
                  plan.ctaStyle === "outline"
                    ? "border border-border text-white hover:bg-surface-hover"
                    : plan.ctaStyle === "primary"
                      ? "bg-primary hover:bg-primary-hover text-white glow-primary shadow-lg shadow-primary/30"
                      : "bg-[#F59E0B] hover:bg-[#F59E0B]/90 text-[#111827] shadow-lg shadow-[#F59E0B]/40",
                ].join(" ")}
              >
                {ctaText}
              </Link>
              {ctaSub && (
                <p className="text-center text-white/50 text-xs mt-2">
                  {ctaSub}
                </p>
              )}
            </div>
          );
        })}
      </div>

      <p className="text-center text-white/60 text-sm mt-12">
        Droši maksājumi ar Stripe. Atcelšana jebkurā laikā.{" "}
        <Link href="/terms" className="underline hover:text-white/80">
          Lietošanas noteikumi
        </Link>
        .
      </p>
    </section>
  );
}
