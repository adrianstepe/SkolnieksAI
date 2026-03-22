"use client";

import { useState } from "react";
import { useAuth } from "@/lib/context/auth-context";

interface UpgradeModalProps {
  onClose: () => void;
}

const PLANS = [
  {
    id: "premium" as const,
    name: "Premium",
    price: "€5.99",
    period: "/mēn.",
    features: [
      "Vairāk jautājumu mēnesī",
      "DeepSeek V3 modelis",
      "Prioritāra atbilde",
      "Pilns Skola2030 saturs",
    ],
    accent: "primary",
  },
  {
    id: "exam_prep" as const,
    name: "Eksāmenu sagatavošana",
    price: "€14.99",
    period: "/mēn.",
    features: [
      "Maksimāls jautājumu skaits",
      "Claude Sonnet — jaudīgākais AI",
      "Eksāmenu simulācijas",
      "Detalizēti paskaidrojumi",
      "Prioritārs atbalsts",
    ],
    accent: "accent",
    popular: true,
  },
];

export function UpgradeModal({ onClose }: UpgradeModalProps) {
  const { getIdToken } = useAuth();
  const [loading, setLoading] = useState<string | null>(null);

  const handleCheckout = async (plan: "premium" | "exam_prep") => {
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
      <div className="relative mx-4 w-full max-w-2xl animate-fade-up rounded-2xl border border-border bg-base p-6 sm:p-8">
        {/* Close button */}
        <button
          onClick={onClose}
          className="absolute right-4 top-4 rounded-lg p-1.5 text-text-muted transition-colors hover:bg-surface hover:text-text-secondary"
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
          <h2 className="text-xl font-semibold text-text-primary">
            Uzlabo savu plānu
          </h2>
          <p className="mt-1 text-sm text-text-secondary">
            Iegūsti vairāk no SkolnieksAI ar premium funkcijām
          </p>
        </div>

        {/* Social proof */}
        <div className="mb-5 flex items-center justify-center gap-2">
          <div className="flex -space-x-2">
            {["A", "M", "K"].map((l) => (
              <div key={l} className="flex h-7 w-7 items-center justify-center rounded-full bg-surface border-2 border-base text-[10px] font-semibold text-text-secondary">
                {l}
              </div>
            ))}
          </div>
          <p className="text-sm text-text-secondary">
            Jau <span className="font-semibold text-text-primary">2 400+</span> skolēni mācās ar SkolnieksAI Premium
          </p>
        </div>

        {/* Plans */}
        <div className="grid gap-4 sm:grid-cols-2">
          {PLANS.map((plan) => (
            <div
              key={plan.id}
              className={`relative flex flex-col rounded-xl border p-5 transition-colors ${
                plan.popular
                  ? "border-accent/40 bg-accent/5"
                  : "border-border bg-surface/50"
              }`}
            >
              {plan.popular && (
                <span className="absolute -top-2.5 left-4 rounded-full bg-accent px-3 py-0.5 text-xs font-semibold text-white">
                  Populārākais
                </span>
              )}

              <h3 className="text-lg font-semibold text-text-primary">
                {plan.name}
              </h3>

              <div className="mt-2 flex items-baseline gap-1">
                <span className="text-2xl font-bold text-text-primary">
                  {plan.price}
                </span>
                <span className="text-sm text-text-secondary">
                  {plan.period}
                </span>
              </div>

              <ul className="mt-4 flex-1 space-y-2">
                {plan.features.map((feature) => (
                  <li
                    key={feature}
                    className="flex items-start gap-2 text-sm text-text-secondary"
                  >
                    <svg
                      className={`mt-0.5 h-4 w-4 shrink-0 ${
                        plan.popular ? "text-accent" : "text-primary"
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
                    {feature}
                  </li>
                ))}
              </ul>

              <button
                onClick={() => handleCheckout(plan.id)}
                disabled={loading !== null}
                className={`mt-5 w-full rounded-lg py-2.5 text-sm font-semibold transition-colors disabled:opacity-50 ${
                  plan.popular
                    ? "bg-accent text-white hover:bg-accent-hover"
                    : "bg-primary text-white hover:bg-primary-hover"
                }`}
              >
                {loading === plan.id ? (
                  <span className="flex items-center justify-center gap-2">
                    <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                    Notiek pāradresēšana...
                  </span>
                ) : (
                  `Izvēlēties ${plan.name}`
                )}
              </button>
            </div>
          ))}
        </div>

        {/* Footer */}
        <p className="mt-5 text-center text-xs text-text-muted">
          Droši maksājumi caur Stripe. Atcelšana jebkurā laikā.
        </p>
      </div>
    </div>
  );
}
