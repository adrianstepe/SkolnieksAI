"use client";

// Parental Consent Verification Page — VPC (Verifiable Parental Consent)
//
// Flow:
//   1. Parent receives email with link: /parental-verify?token={consentId}
//   2. This page loads, reads the token, shows explanation
//   3. Parent enters card details (Stripe Elements via vanilla @stripe/stripe-js)
//   4. On submit: creates PaymentIntent → confirms card → calls /verify endpoint
//   5. On success: account created, refund issued, password-setup email sent to child
//
// Note: this page is intentionally placed outside the (auth) route group to avoid
// the auth layout redirecting parents who happen to have a SkolnieksAI account.

import { Suspense, useEffect, useRef, useState, type FormEvent } from "react";
import { useSearchParams } from "next/navigation";
import { loadStripe, type Stripe, type StripeCardElement } from "@stripe/stripe-js";
import Link from "next/link";

type Step = "loading" | "ready" | "paying" | "success" | "error";

export default function ParentalVerifyPage() {
  return (
    <Suspense fallback={<PageShell><div className="text-center text-sm text-text-muted">Ielādē...</div></PageShell>}>
      <ParentalVerifyContent />
    </Suspense>
  );
}

function ParentalVerifyContent() {
  const searchParams = useSearchParams();
  const consentId = searchParams.get("token");

  const [step, setStep] = useState<Step>("loading");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Stripe refs
  const stripeRef = useRef<Stripe | null>(null);
  const cardRef = useRef<StripeCardElement | null>(null);
  const cardMountRef = useRef<HTMLDivElement>(null);

  // Mount Stripe Elements once the card container is visible
  useEffect(() => {
    const initialize = async () => {
      if (!consentId) {
        setErrorMsg("Saite ir nederīga. Lūdzu, pārbaudiet e-pastu un mēģiniet vēlreiz.");
        setStep("error");
        return;
      }

      const pk = process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY;
      if (!pk) {
        setErrorMsg("Maksājumu sistēma nav pieejama. Lūdzu, sazinieties ar atbalstu.");
        setStep("error");
        return;
      }

      const stripe = await loadStripe(pk);
      if (!stripe) {
        setErrorMsg("Neizdevās ielādēt maksājumu sistēmu. Mēģiniet pārlādēt lapu.");
        setStep("error");
        return;
      }
      stripeRef.current = stripe;
      setStep("ready");
    };

    void initialize();
  }, [consentId]);

  // Mount the card element once the container div is rendered
  useEffect(() => {
    if (step !== "ready" || !stripeRef.current || !cardMountRef.current) return;
    if (cardRef.current) return; // already mounted

    const elements = stripeRef.current.elements();
    const card = elements.create("card", {
      style: {
        base: {
          fontSize: "14px",
          color: "#e2e8f0",
          "::placeholder": { color: "#64748b" },
          iconColor: "#94a3b8",
        },
        invalid: { color: "#f87171" },
      },
    });
    card.mount(cardMountRef.current);
    cardRef.current = card;
  }, [step]);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!stripeRef.current || !cardRef.current || !consentId) return;

    setStep("paying");
    setErrorMsg(null);

    // Step 1: create a PaymentIntent for €0.01 on the server
    let clientSecret: string;
    try {
      const res = await fetch("/api/auth/parental-consent/create-intent", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ consentId }),
      });
      const data = (await res.json()) as { clientSecret?: string; error?: string };
      if (!res.ok || !data.clientSecret) {
        const msg =
          data.error === "consent_already_processed"
            ? "Šī reģistrācija jau ir apstiprināta."
            : "Neizdevās uzsākt maksājumu. Mēģiniet vēlreiz.";
        setErrorMsg(msg);
        setStep("ready");
        return;
      }
      clientSecret = data.clientSecret;
    } catch {
      setErrorMsg("Savienojuma kļūda. Pārbaudiet interneta savienojumu un mēģiniet vēlreiz.");
      setStep("ready");
      return;
    }

    // Step 2: confirm the card payment (Stripe handles SCA / 3DS if required)
    const { error, paymentIntent } = await stripeRef.current.confirmCardPayment(clientSecret, {
      payment_method: { card: cardRef.current },
    });

    if (error) {
      setErrorMsg(
        error.code === "card_declined"
          ? "Karte noraidīta. Lūdzu, pārbaudiet kartes datus vai izmantojiet citu karti."
          : error.message ?? "Maksājuma kļūda. Mēģiniet vēlreiz.",
      );
      setStep("ready");
      return;
    }

    if (!paymentIntent || paymentIntent.status !== "succeeded") {
      setErrorMsg("Maksājums nav pabeigts. Mēģiniet vēlreiz.");
      setStep("ready");
      return;
    }

    // Step 3: tell the server to create the child's account and issue the refund
    try {
      const res = await fetch("/api/auth/parental-consent/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ consentId, paymentIntentId: paymentIntent.id }),
      });
      if (!res.ok) {
        const data = (await res.json()) as { error?: string };
        const msg =
          data.error === "already_processed"
            ? "Šī reģistrācija jau ir apstiprināta."
            : "Konta izveide neizdevās. Lūdzu, sazinieties ar atbalstu.";
        setErrorMsg(msg);
        setStep("ready");
        return;
      }
    } catch {
      setErrorMsg("Savienojuma kļūda pēc maksājuma. Sazinieties ar atbalstu — bērna konts, iespējams, izveidots.");
      setStep("ready");
      return;
    }

    setStep("success");
  };

  // ---------------------------------------------------------------------------
  // Render states
  // ---------------------------------------------------------------------------

  if (step === "error") {
    return (
      <PageShell>
        <div className="text-center space-y-4">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl bg-red-500/10">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="h-6 w-6 text-red-400">
              <path fillRule="evenodd" d="M18 10a8 8 0 1 1-16 0 8 8 0 0 1 16 0Zm-8-5a.75.75 0 0 1 .75.75v4.5a.75.75 0 0 1-1.5 0v-4.5A.75.75 0 0 1 10 5Zm0 10a1 1 0 1 0 0-2 1 1 0 0 0 0 2Z" clipRule="evenodd" />
            </svg>
          </div>
          <p className="text-sm text-red-400">{errorMsg}</p>
          <Link href="/" className="inline-block text-sm text-text-muted hover:text-text-secondary">
            Atgriezties uz sākumu →
          </Link>
        </div>
      </PageShell>
    );
  }

  if (step === "success") {
    return (
      <PageShell>
        <div className="text-center space-y-4">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl bg-green-500/10">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="h-6 w-6 text-green-500">
              <path fillRule="evenodd" d="M16.704 4.153a.75.75 0 0 1 .143 1.052l-8 10.5a.75.75 0 0 1-1.127.075l-4.5-4.5a.75.75 0 0 1 1.06-1.06l3.894 3.893 7.48-9.817a.75.75 0 0 1 1.05-.143Z" clipRule="evenodd" />
            </svg>
          </div>
          <h1 className="text-lg font-semibold text-text-primary">Reģistrācija apstiprināta!</h1>
          <p className="text-sm text-text-secondary leading-relaxed">
            Jūsu bērna konts ir izveidots. €0.01 tika nekavējoties atmaksāts.
            <br /><br />
            Jūsu bērns saņems e-pastu ar saiti paroles iestatīšanai, pēc kuras varēs pieteikties.
          </p>
          <Link
            href="/"
            className="inline-block text-sm font-medium text-primary hover:text-primary-hover"
          >
            Doties uz SkolnieksAI →
          </Link>
        </div>
      </PageShell>
    );
  }

  return (
    <PageShell>
      <div className="space-y-6">
        {/* Header */}
        <div className="text-center">
          <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="h-6 w-6 text-primary">
              <path fillRule="evenodd" d="M10 1a4.5 4.5 0 0 0-4.5 4.5V9H5a2 2 0 0 0-2 2v6a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-6a2 2 0 0 0-2-2h-.5V5.5A4.5 4.5 0 0 0 10 1Zm3 8V5.5a3 3 0 1 0-6 0V9h6Z" clipRule="evenodd" />
            </svg>
          </div>
          <h1 className="text-lg font-semibold text-text-primary">Vecāku identitātes pārbaude</h1>
          <p className="mt-2 text-sm text-text-secondary leading-relaxed">
            Lai apstiprinātu sava bērna kontu, mēs pārbaudīsim jūsu identitāti ar{" "}
            <span className="font-medium text-text-primary">€0.01 maksājumu</span>, kas tiks
            nekavējoties atmaksāts. Tas nodrošina GDPR 8. panta prasību — ka piekrišanu sniedz
            īsts pieaugušais.
          </p>
        </div>

        {/* Info box */}
        <div className="rounded-lg border border-border bg-surface/50 px-4 py-3 text-xs text-text-muted space-y-1">
          <p>• €0.01 tiek iekasēts tikai identitātes pārbaudei</p>
          <p>• Atmaksa notiek automātiski uzreiz pēc apstiprinājuma</p>
          <p>• Kartes dati netiek glabāti — apstrādā Stripe</p>
        </div>

        {errorMsg && (
          <div className="rounded-lg bg-red-900/20 px-4 py-3 text-sm text-red-400 border border-red-900/30">
            {errorMsg}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-text-secondary mb-1">
              Kartes dati
            </label>
            {/* Vanilla Stripe card element mounts here */}
            <div
              ref={cardMountRef}
              className="rounded-lg border border-border bg-surface px-3 py-3 min-h-[42px]"
            />
          </div>

          <button
            type="submit"
            disabled={step === "loading" || step === "paying"}
            className="w-full rounded-lg bg-primary px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-primary-hover focus:outline-none focus:ring-2 focus:ring-primary/50 focus:ring-offset-2 focus:ring-offset-base disabled:opacity-50"
          >
            {step === "paying"
              ? "Apstiprina..."
              : step === "loading"
                ? "Ielādē..."
                : "Apstiprināt un atmaksāt €0.01"}
          </button>
        </form>

        <p className="text-center text-xs text-text-muted">
          Drošu maksājumu apstrādi nodrošina{" "}
          <span className="font-medium">Stripe</span>. SkolnieksAI nekad neglabā kartes datus.
        </p>
      </div>
    </PageShell>
  );
}

function PageShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-base px-4 py-12">
      <div className="w-full max-w-sm">
        <div className="rounded-2xl border border-border bg-surface/50 p-6 shadow-xl shadow-black/20">
          {children}
        </div>
        <p className="mt-6 text-center text-xs text-text-muted">
          SkolnieksAI · AI mācību palīgs
        </p>
      </div>
    </div>
  );
}
