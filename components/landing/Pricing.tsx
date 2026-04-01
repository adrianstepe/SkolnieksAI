import Link from "next/link";
import { Check } from "lucide-react";

const PLANS = [
  {
    id: "free",
    name: "Bezmaksas",
    price: "€0",
    features: [
      "Ierobežots jautājumu skaits (~60/mēn.)",
      "Standarta palīgs",
      "Visi priekšmeti, ierobežots jautājumu skaits",
    ],
    cta: "Sākt bezmaksas",
    ctaStyle: "outline",
    badge: null,
  },
  {
    id: "pro",
    name: "Pro",
    price: "€5.99",
    features: [
      "Vairāk jautājumu mēnesī",
      "Pilns palīgs",
      "Prioritāra atbilde",
      "Pilns izglītības saturs",
    ],
    cta: "Izvēlēties Pro — €5.99/mēn.",
    ctaStyle: "primary",
    badge: "popular",
  },
  {
    id: "premium",
    name: "Premium",
    price: "€14.99",
    features: [
      { bold: "Claude Sonnet 4.6", suffix: " (Augstākā precizitāte)" },
      "Eksāmenu līmeņa uzdevumu ģenerēšana",
      "Detalizēta soļu-pa-solim analīze",
      "Pielāgots Latvijas izglītības standartiem",
    ],
    cta: "Sākt Premium — €14.99/mēn.",
    ctaStyle: "accent",
    badge: "exam",
  },
] as const;

type Feature = string | { bold: string; suffix: string };

function FeatureItem({ feature, popular }: { feature: Feature; popular: boolean }) {
  const checkColor = popular ? "text-primary" : "text-emerald-400";
  if (typeof feature === "string") {
    return (
      <li className="flex items-start gap-3 text-sm text-white/80">
        <Check size={16} className={`${checkColor} shrink-0 mt-0.5`} />
        {feature}
      </li>
    );
  }
  return (
    <li className="flex items-start gap-3 text-sm text-white/80">
      <Check size={16} className={`${checkColor} shrink-0 mt-0.5`} />
      <span>
        <strong className="font-semibold text-white">{feature.bold}</strong>
        {feature.suffix}
      </span>
    </li>
  );
}

export function Pricing() {
  return (
    <section className="py-24 max-w-7xl mx-auto px-6">
      <h2 className="text-3xl md:text-5xl font-heading font-bold text-center text-white mb-16">
        Plāni un cenas
      </h2>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-center">
        {PLANS.map((plan) => {
          const isPopular = plan.badge === "popular";
          const isExam = plan.badge === "exam";

          return (
            <div
              key={plan.id}
              className={[
                "relative flex flex-col rounded-3xl border transition-all duration-300",
                isPopular
                  ? [
                      "bg-primary/10 border-primary/60 ring-2 ring-primary shadow-2xl shadow-primary/20",
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
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-3.5 h-3.5">
                      <path fillRule="evenodd" d="M10.868 2.884c-.321-.772-1.415-.772-1.736 0l-1.83 4.401-4.753.381c-.833.067-1.171 1.107-.536 1.651l3.62 3.102-1.106 4.637c-.194.813.691 1.456 1.405 1.02L10 15.591l4.069 2.485c.713.436 1.598-.207 1.404-1.02l-1.106-4.637 3.62-3.102c.635-.544.297-1.584-.536-1.65l-4.752-.382-1.831-4.401z" clipRule="evenodd" />
                    </svg>
                    Populārākais
                  </span>
                </div>
              )}
              {isExam && (
                <div className="absolute -top-4 left-0 right-0 flex justify-center">
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-gradient-to-r from-amber-500 to-yellow-400 px-4 py-1 text-[11px] font-bold uppercase tracking-widest text-black shadow-lg shadow-amber-500/30">
                    🏆 Eksāmenu Tops
                  </span>
                </div>
              )}

              <h3 className={[
                "text-xl font-bold mb-2",
                isPopular ? "text-primary" : "text-white",
              ].join(" ")}>
                {plan.name}
              </h3>

              <div className="flex items-baseline gap-1 mb-8">
                <span className="text-4xl font-bold text-white">{plan.price}</span>
                <span className="text-white/60">/mēn.</span>
              </div>

              <ul className="space-y-4 mb-10 flex-grow">
                {plan.features.map((f, i) => (
                  <FeatureItem key={i} feature={f as Feature} popular={isPopular} />
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
                    : "bg-gradient-to-r from-amber-500 to-yellow-400 hover:from-amber-600 hover:to-yellow-500 text-black shadow-lg shadow-amber-500/25",
                ].join(" ")}
              >
                {plan.cta}
              </Link>
            </div>
          );
        })}
      </div>
      <p className="text-center text-white/60 text-sm mt-12">
        Skolām: Skolu Pro plāns no €20/skolēnu gadā.
      </p>
    </section>
  );
}
