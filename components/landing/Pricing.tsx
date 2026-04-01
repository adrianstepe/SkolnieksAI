import Link from "next/link";
import { Check } from "lucide-react";

const PLANS = [
  {
    name: "Bezmaksas",
    price: "€0",
    features: [
      "Līdz 40 jautājumiem mēnesī",
      "Atbildes latviešu valodā",
      "DeepSeek AI modelis",
    ],
    cta: "Sākt bez maksas",
    highlight: false,
    outline: true,
  },
  {
    name: "Pro",
    price: "€5.99",
    features: [
      "Neierobežoti jautājumi",
      "Claude AI modelis",
      "Prioritāra atbilde",
    ],
    cta: "Izmēģināt Pro",
    highlight: true,
    outline: false,
  },
  {
    name: "Premium",
    price: "€14.99",
    features: [
      "Viss no Pro",
      "Eksāmenu simulācijas",
      "Personalizēts mācību plāns",
    ],
    cta: "Izmēģināt Premium",
    highlight: false,
    outline: false,
  },
];

export function Pricing() {
  return (
    <section className="py-24 max-w-7xl mx-auto px-6">
      <h2 className="text-3xl md:text-5xl font-heading font-bold text-center text-white mb-16">
        Plāni un cenas
      </h2>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-8 items-stretch">
        {PLANS.map((plan, idx) => (
          <div
            key={idx}
            className={[
              "flex flex-col p-8 rounded-3xl border transition-all duration-300",
              "hover:-translate-y-2 hover:shadow-2xl",
              plan.highlight
                ? "bg-primary/5 border-primary shadow-2xl scale-105 z-10"
                : "bg-surface border-border",
            ].join(" ")}
          >
            <h3 className="text-xl font-bold text-white mb-2">
              {plan.name}
            </h3>
            <div className="flex items-baseline gap-1 mb-8">
              <span className="text-4xl font-bold text-white">
                {plan.price}
              </span>
              <span className="text-white/60">/mēn</span>
            </div>
            <ul className="space-y-4 mb-10 flex-grow">
              {plan.features.map((f, i) => (
                <li
                  key={i}
                  className="flex items-start gap-3 text-sm text-white/80"
                >
                  <Check size={18} className="text-primary shrink-0" />
                  {f}
                </li>
              ))}
            </ul>
            <Link
              href="/signup"
              className={[
                "w-full py-4 rounded-xl font-bold transition-all text-center block",
                plan.outline
                  ? "border border-border text-white hover:bg-surface-hover"
                  : "bg-primary hover:bg-primary-hover text-white glow-primary",
              ].join(" ")}
            >
              {plan.cta}
            </Link>
          </div>
        ))}
      </div>
      <p className="text-center text-white/60 text-sm mt-12">
        Skolām: Skolu Pro plāns no €20/skolēnu gadā.
      </p>
    </section>
  );
}
