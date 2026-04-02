"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import { LogoWordmark } from "@/components/LogoWordmark";

type State = "idle" | "loading" | "success" | "error";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [state, setState] = useState<State>("idle");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setState("loading");

    try {
      const res = await fetch("/api/auth/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });

      if (!res.ok) {
        const data = (await res.json()) as { error?: string };
        if (data.error === "validation_error") {
          setErrorMsg("Lūdzu ievadi derīgu e-pasta adresi.");
          setState("error");
          return;
        }
        throw new Error("server_error");
      }

      setState("success");
    } catch {
      setErrorMsg("Kaut kas nogāja greizi. Lūdzu mēģini vēlreiz.");
      setState("error");
    }
  };

  const inputClass =
    "mt-1 block w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm text-text-primary placeholder:text-text-muted focus:border-primary/40 focus:outline-none focus:ring-1 focus:ring-primary/20";

  return (
    <div className="space-y-6">
      <div className="text-center">
        <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-xl bg-primary">
          <span className="text-[#F9FAFB] font-bold text-xl leading-none select-none" style={{ fontFamily: "var(--font-sora), 'Sora', sans-serif" }}>S</span>
        </div>
        <h1 className="flex justify-center">
          <LogoWordmark size="lg" />
        </h1>
        <p className="mt-1 text-sm text-text-secondary">Atjaunot paroli</p>
      </div>

      {state === "success" ? (
        <div className="space-y-4 text-center">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-green-900/20">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="h-6 w-6 text-green-400">
              <path fillRule="evenodd" d="M16.704 4.153a.75.75 0 0 1 .143 1.052l-8 10.5a.75.75 0 0 1-1.127.075l-4.5-4.5a.75.75 0 0 1 1.06-1.06l3.894 3.893 7.48-9.817a.75.75 0 0 1 1.05-.143Z" clipRule="evenodd" />
            </svg>
          </div>
          <div>
            <p className="text-sm font-medium text-text-primary">Pārbaudi savu iesūtni</p>
            <p className="mt-1 text-sm text-text-secondary">
              Ja šis e-pasts ir reģistrēts, saite tika nosūtīta. Saite ir derīga <strong>5 minūtes</strong>.
            </p>
          </div>
          <Link
            href="/login"
            className="inline-block text-sm font-medium text-primary hover:text-primary-hover"
          >
            ← Atpakaļ uz pieteikšanos
          </Link>
        </div>
      ) : (
        <>
          {state === "error" && errorMsg && (
            <div className="rounded-lg bg-red-900/20 px-4 py-3 text-sm text-red-400 border border-red-900/30">
              {errorMsg}
            </div>
          )}

          <p className="text-sm text-text-secondary">
            Ievadi sava konta e-pastu un mēs nosūtīsim saiti paroles atjaunošanai.
          </p>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-text-secondary">
                E-pasts
              </label>
              <input
                id="email"
                type="email"
                required
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className={inputClass}
                placeholder="tavs@epasts.lv"
              />
            </div>

            <button
              type="submit"
              disabled={state === "loading"}
              className="w-full rounded-lg bg-primary px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-primary-hover focus:outline-none focus:ring-2 focus:ring-primary/50 focus:ring-offset-2 focus:ring-offset-base disabled:opacity-50"
            >
              {state === "loading" ? (
                <span className="flex items-center justify-center gap-2">
                  <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                  Sūta...
                </span>
              ) : (
                "Sūtīt saiti"
              )}
            </button>
          </form>

          <p className="text-center text-sm text-text-secondary">
            <Link href="/login" className="font-medium text-primary hover:text-primary-hover">
              ← Atpakaļ uz pieteikšanos
            </Link>
          </p>
        </>
      )}
    </div>
  );
}
