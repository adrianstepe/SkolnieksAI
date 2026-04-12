"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

type PlanParam = "pro" | "premium";
type IntervalParam = "monthly" | "annual";

function parsePlan(raw: string | null): PlanParam | null {
  return raw === "pro" || raw === "premium" ? raw : null;
}

function parseInterval(raw: string | null): IntervalParam | null {
  return raw === "monthly" || raw === "annual" ? raw : null;
}

/** Shown when the user returns from Stripe Checkout (query params from session). */
function abandonedCheckoutLine(plan: PlanParam, interval: IntervalParam): string {
  const labels: Record<PlanParam, Record<IntervalParam, string>> = {
    pro: {
      monthly: "Pro — €5,99/mēn.",
      annual: "Pro — €59,99/gadā",
    },
    premium: {
      monthly: "Premium — €14,99/mēn.",
      annual: "Premium — €143,99/gadā",
    },
  };
  return labels[plan][interval];
}

export default function PaymentCancelPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [countdown, setCountdown] = useState(3);

  const checkoutContext = useMemo(() => {
    const plan = parsePlan(searchParams.get("plan"));
    const interval = parseInterval(searchParams.get("interval"));
    if (!plan || !interval) return null;
    return abandonedCheckoutLine(plan, interval);
  }, [searchParams]);

  useEffect(() => {
    const timer = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          router.push("/");
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [router]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-base">
      <div className="mx-4 max-w-md text-center animate-fade-up">
        <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-full bg-surface">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 20 20"
            fill="currentColor"
            className="h-8 w-8 text-text-muted"
          >
            <path d="M6.28 5.22a.75.75 0 0 0-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 1 0 1.06 1.06L10 11.06l3.72 3.72a.75.75 0 1 0 1.06-1.06L11.06 10l3.72-3.72a.75.75 0 0 0-1.06-1.06L10 8.94 6.28 5.22Z" />
          </svg>
        </div>

        <h1 className="text-2xl font-bold text-text-primary">
          Maksājums atcelts
        </h1>
        <p className="mt-2 text-text-secondary">
          Maksājums netika veikts. Tu vari mēģināt vēlreiz jebkurā laikā.
        </p>

        {checkoutContext && (
          <p className="mt-4 rounded-lg bg-surface px-4 py-3 text-sm text-text-secondary">
            Atceltais maksājums:{" "}
            <span className="font-semibold text-text-primary">
              {checkoutContext}
            </span>
          </p>
        )}

        <p className="mt-6 text-sm text-text-muted">
          Pāradresēšana pēc {countdown} sekundēm...
        </p>

        <button
          onClick={() => router.push("/")}
          className="mt-4 rounded-lg bg-surface px-6 py-2.5 text-sm font-semibold text-text-primary transition-colors hover:bg-surface-hover"
        >
          Atgriezties uz čatu
        </button>
      </div>
    </div>
  );
}
