"use client";

// EU Directive 2023/2673 — standardised 2-click cancellation flow.
// Step 1: Contract summary + "Atteikties no līguma" button.
// Step 2: Confirmation page with user email + "Apstiprināt atteikumu" button.
// No retention prompts, discounts, or extra modals permitted by the directive.

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/lib/context/auth-context";

const TIER_NAMES: Record<string, string> = {
  pro: "Pro",
  premium: "Premium",
  school_pro: "School Pro",
};

function subscriptionPriceLabel(
  tier: string,
  billingInterval: "monthly" | "annual" | undefined,
): string {
  if (tier === "pro") {
    return billingInterval === "annual" ? "€59,99/gadā" : "€5,99/mēn.";
  }
  if (tier === "premium") {
    return billingInterval === "annual" ? "€143,99/gadā" : "€14,99/mēn.";
  }
  return "";
}

type Step = "summary" | "confirm" | "done";

export default function CancelPage() {
  const { user, profile, loading, getIdToken, refreshProfile } = useAuth();
  const router = useRouter();

  const [step, setStep] = useState<Step>("summary");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [cancelledAt, setCancelledAt] = useState<string | null>(null);

  useEffect(() => {
    if (!loading && !user) {
      router.replace("/login");
    }
  }, [user, loading, router]);

  if (loading || !user || !profile) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#F9FAFB] dark:bg-[#0F1117]">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-[#2563EB]/20 border-t-[#2563EB]" />
      </div>
    );
  }

  const isSubscribed =
    profile.tier === "pro" ||
    profile.tier === "premium" ||
    profile.tier === "school_pro";

  if (!isSubscribed) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#F9FAFB] dark:bg-[#0F1117] px-4">
        <div className="w-full max-w-sm rounded-2xl border border-[#E5E7EB] dark:border-white/7 bg-white dark:bg-[#151926] p-8 text-center shadow-lg">
          <p className="text-base font-medium text-[#374151] dark:text-[#8B95A8]">
            Nav aktīva abonementa.
          </p>
          <Link
            href="/"
            className="mt-6 inline-block text-sm font-medium text-[#2563EB] dark:text-[#4F8EF7] hover:underline"
          >
            Atpakaļ uz sākumu
          </Link>
        </div>
      </div>
    );
  }

  const tierInfo = {
    name: TIER_NAMES[profile.tier] ?? profile.tier,
    price: subscriptionPriceLabel(profile.tier, profile.billingInterval),
  };

  const handleConfirm = async () => {
    setSubmitting(true);
    setError(null);
    try {
      const token = await getIdToken();
      if (!token) throw new Error("Nav autentifikācijas tokena");

      const res = await fetch("/api/stripe/cancel", {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!res.ok) {
        const data = (await res.json()) as { error?: string };
        throw new Error(data.error ?? "Nezināma kļūda");
      }

      const data = (await res.json()) as { cancelledAt: string };
      setCancelledAt(data.cancelledAt);
      await refreshProfile();
      setStep("done");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Kļūda. Lūdzu mēģiniet vēlreiz.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-[#F9FAFB] dark:bg-[#0F1117] px-4 py-12">
      <div className="w-full max-w-md">
        {/* Step 1 — Contract summary */}
        {step === "summary" && (
          <div className="rounded-2xl border border-[#E5E7EB] dark:border-white/7 bg-white dark:bg-[#151926] p-8 shadow-lg">
            <h1 className="text-xl font-bold text-[#111827] dark:text-[#E8ECF4]">
              Atteikties no līguma
            </h1>
            <p className="mt-2 text-sm text-[#6B7280] dark:text-[#8B95A8]">
              Direktīva 2023/2673 — standartizēta atteikšanās procedūra
            </p>

            <div className="mt-6 rounded-xl border border-[#E5E7EB] dark:border-white/7 bg-[#F9FAFB] dark:bg-[#0D1117] px-5 py-4 space-y-2">
              <p className="text-xs font-semibold uppercase tracking-wide text-[#6B7280] dark:text-[#8B95A8]">
                Līguma kopsavilkums
              </p>
              <div className="flex justify-between text-sm">
                <span className="text-[#374151] dark:text-[#8B95A8]">Plāns</span>
                <span className="font-semibold text-[#111827] dark:text-[#E8ECF4]">
                  {tierInfo.name}
                </span>
              </div>
              {tierInfo.price && (
                <div className="flex justify-between text-sm">
                  <span className="text-[#374151] dark:text-[#8B95A8]">Cena</span>
                  <span className="font-semibold text-[#111827] dark:text-[#E8ECF4]">
                    {tierInfo.price}
                  </span>
                </div>
              )}
              <div className="flex justify-between text-sm">
                <span className="text-[#374151] dark:text-[#8B95A8]">E-pasts</span>
                <span className="font-semibold text-[#111827] dark:text-[#E8ECF4] truncate max-w-[200px]">
                  {user.email}
                </span>
              </div>
            </div>

            <p className="mt-5 text-sm text-[#374151] dark:text-[#8B95A8] leading-relaxed">
              Nospiežot pogu zemāk, jūs atceļat abonementu nekavējoties. Jūs saņemsiet apstiprinājuma e-pastu.
            </p>

            <button
              onClick={() => setStep("confirm")}
              className="mt-6 w-full rounded-xl bg-red-600 px-4 py-3 text-sm font-bold text-white transition-colors hover:bg-red-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-600"
            >
              Atteikties no līguma
            </button>

            <Link
              href="/"
              className="mt-4 block text-center text-sm text-[#6B7280] dark:text-[#8B95A8] hover:text-[#374151] dark:hover:text-[#E8ECF4] transition-colors"
            >
              Atpakaļ
            </Link>
          </div>
        )}

        {/* Step 2 — Confirmation */}
        {step === "confirm" && (
          <div className="rounded-2xl border border-[#E5E7EB] dark:border-white/7 bg-white dark:bg-[#151926] p-8 shadow-lg">
            <h1 className="text-xl font-bold text-[#111827] dark:text-[#E8ECF4]">
              Apstiprināt atteikumu
            </h1>

            <p className="mt-4 text-sm text-[#374151] dark:text-[#8B95A8] leading-relaxed">
              Apstiprinājums tiks nosūtīts uz:
            </p>
            <p className="mt-1 text-sm font-semibold text-[#111827] dark:text-[#E8ECF4]">
              {user.email}
            </p>

            <p className="mt-4 text-sm text-[#374151] dark:text-[#8B95A8] leading-relaxed">
              Abonements tiks atcelts nekavējoties. Jūs pāriesiet uz bezmaksas plānu.
            </p>

            {error && (
              <p className="mt-4 rounded-lg bg-red-50 dark:bg-red-900/20 px-4 py-2.5 text-sm text-red-600 dark:text-red-400">
                {error}
              </p>
            )}

            <button
              onClick={handleConfirm}
              disabled={submitting}
              className="mt-6 w-full rounded-xl bg-red-600 px-4 py-3 text-sm font-bold text-white transition-colors hover:bg-red-700 disabled:opacity-60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-600 flex items-center justify-center gap-2"
            >
              {submitting ? (
                <>
                  <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                  Notiek atcelšana...
                </>
              ) : (
                "Apstiprināt atteikumu"
              )}
            </button>

            <button
              onClick={() => setStep("summary")}
              disabled={submitting}
              className="mt-4 w-full text-center text-sm text-[#6B7280] dark:text-[#8B95A8] hover:text-[#374151] dark:hover:text-[#E8ECF4] transition-colors disabled:opacity-40"
            >
              Atpakaļ
            </button>
          </div>
        )}

        {/* Done — success */}
        {step === "done" && (
          <div className="rounded-2xl border border-[#E5E7EB] dark:border-white/7 bg-white dark:bg-[#151926] p-8 shadow-lg text-center">
            <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-green-100 dark:bg-green-900/30">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 20 20"
                fill="currentColor"
                className="h-6 w-6 text-green-600 dark:text-green-400"
              >
                <path
                  fillRule="evenodd"
                  d="M16.704 4.153a.75.75 0 0 1 .143 1.052l-8 10.5a.75.75 0 0 1-1.127.075l-4.5-4.5a.75.75 0 0 1 1.06-1.06l3.894 3.893 7.48-9.817a.75.75 0 0 1 1.05-.143Z"
                  clipRule="evenodd"
                />
              </svg>
            </div>

            <h1 className="text-xl font-bold text-[#111827] dark:text-[#E8ECF4]">
              Abonements atcelts
            </h1>

            <p className="mt-3 text-sm text-[#374151] dark:text-[#8B95A8] leading-relaxed">
              Jūsu abonements ir atcelts. Apstiprinājums nosūtīts uz{" "}
              <span className="font-medium text-[#111827] dark:text-[#E8ECF4]">
                {user.email}
              </span>
              .
            </p>

            {cancelledAt && (
              <p className="mt-2 text-xs text-[#6B7280] dark:text-[#8B95A8]">
                Datums:{" "}
                {new Date(cancelledAt).toLocaleString("lv-LV", {
                  dateStyle: "long",
                  timeStyle: "short",
                })}
              </p>
            )}

            <Link
              href="/"
              className="mt-6 inline-block rounded-xl bg-[#2563EB] px-6 py-2.5 text-sm font-bold text-white transition-colors hover:bg-[#1d4ed8]"
            >
              Turpināt ar bezmaksas plānu
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}
