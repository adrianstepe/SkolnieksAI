"use client";

import { useState, useEffect, type FormEvent } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { LogoWordmark } from "@/components/LogoWordmark";

type TokenState = "checking" | "valid" | "expired" | "used" | "not_found";
type SubmitState = "idle" | "submitting" | "success" | "error";

interface VerifyResponse {
  valid: boolean;
  reason?: "expired" | "used" | "not_found";
  maskedEmail?: string;
}

export default function ResetPasswordPage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const token = searchParams.get("token") ?? "";

  const [tokenState, setTokenState] = useState<TokenState>("checking");
  const [maskedEmail, setMaskedEmail] = useState<string | null>(null);
  const [password, setPassword] = useState("");
  const [passwordConfirm, setPasswordConfirm] = useState("");
  const [submitState, setSubmitState] = useState<SubmitState>("idle");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Verify the token on mount
  useEffect(() => {
    if (!token) {
      setTokenState("not_found");
      return;
    }

    const verify = async () => {
      try {
        const res = await fetch(
          `/api/auth/verify-reset-token?token=${encodeURIComponent(token)}`,
        );
        const data = (await res.json()) as VerifyResponse;

        if (data.valid) {
          setMaskedEmail(data.maskedEmail ?? null);
          setTokenState("valid");
        } else {
          setTokenState(data.reason ?? "not_found");
        }
      } catch {
        setTokenState("not_found");
      }
    };

    void verify();
  }, [token]);

  // Auto-redirect to /login 3 seconds after successful reset
  useEffect(() => {
    if (submitState !== "success") return;
    const t = setTimeout(() => router.replace("/login"), 3000);
    return () => clearTimeout(t);
  }, [submitState, router]);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    if (password.length < 8) {
      setErrorMsg("Parolei jābūt vismaz 8 simbolus garai.");
      return;
    }
    if (password !== passwordConfirm) {
      setErrorMsg("Paroles nesakrīt.");
      return;
    }

    setSubmitState("submitting");

    try {
      const res = await fetch("/api/auth/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, password }),
      });

      if (res.ok) {
        setSubmitState("success");
        return;
      }

      const data = (await res.json()) as { error?: string };
      if (data.error === "expired") {
        setTokenState("expired");
      } else if (data.error === "used") {
        setTokenState("used");
      } else if (data.error === "not_found") {
        setTokenState("not_found");
      } else {
        setErrorMsg("Kaut kas nogāja greizi. Lūdzu mēģini vēlreiz.");
        setSubmitState("error");
      }
    } catch {
      setErrorMsg("Kaut kas nogāja greizi. Lūdzu mēģini vēlreiz.");
      setSubmitState("error");
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
        <p className="mt-1 text-sm text-text-secondary">Jauna parole</p>
      </div>

      {/* Checking token */}
      {tokenState === "checking" && (
        <div className="flex items-center justify-center gap-2 py-8 text-sm text-text-secondary">
          <span className="h-4 w-4 animate-spin rounded-full border-2 border-border border-t-primary" />
          Pārbauda saiti...
        </div>
      )}

      {/* Token expired */}
      {tokenState === "expired" && (
        <div className="space-y-4 text-center">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-yellow-900/20">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="h-6 w-6 text-yellow-400">
              <path fillRule="evenodd" d="M8.485 2.495c.673-1.167 2.357-1.167 3.03 0l6.28 10.875c.673 1.167-.17 2.625-1.516 2.625H3.72c-1.347 0-2.189-1.458-1.515-2.625L8.485 2.495ZM10 5a.75.75 0 0 1 .75.75v3.5a.75.75 0 0 1-1.5 0v-3.5A.75.75 0 0 1 10 5Zm0 9a1 1 0 1 0 0-2 1 1 0 0 0 0 2Z" clipRule="evenodd" />
            </svg>
          </div>
          <div>
            <p className="text-sm font-medium text-text-primary">Saite ir beigusies</p>
            <p className="mt-1 text-sm text-text-secondary">
              Paroles atiestatīšanas saite ir derīga tikai 5 minūtes. Lūdzu, pieprasi jaunu.
            </p>
          </div>
          <Link href="/forgot-password" className="inline-block text-sm font-medium text-primary hover:text-primary-hover">
            Pieprasīt jaunu saiti →
          </Link>
        </div>
      )}

      {/* Token already used */}
      {tokenState === "used" && (
        <div className="space-y-4 text-center">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-blue-900/20">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="h-6 w-6 text-blue-400">
              <path fillRule="evenodd" d="M16.704 4.153a.75.75 0 0 1 .143 1.052l-8 10.5a.75.75 0 0 1-1.127.075l-4.5-4.5a.75.75 0 0 1 1.06-1.06l3.894 3.893 7.48-9.817a.75.75 0 0 1 1.05-.143Z" clipRule="evenodd" />
            </svg>
          </div>
          <div>
            <p className="text-sm font-medium text-text-primary">Parole jau nomainīta</p>
            <p className="mt-1 text-sm text-text-secondary">
              Šī saite jau tika izmantota. Piesakies ar jauno paroli.
            </p>
          </div>
          <Link href="/login" className="inline-block text-sm font-medium text-primary hover:text-primary-hover">
            Iet uz pieteikšanos →
          </Link>
        </div>
      )}

      {/* Token not found / invalid */}
      {tokenState === "not_found" && (
        <div className="space-y-4 text-center">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-red-900/20">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="h-6 w-6 text-red-400">
              <path fillRule="evenodd" d="M18 10a8 8 0 1 1-16 0 8 8 0 0 1 16 0Zm-8-5a.75.75 0 0 1 .75.75v4.5a.75.75 0 0 1-1.5 0v-4.5A.75.75 0 0 1 10 5Zm0 10a1 1 0 1 0 0-2 1 1 0 0 0 0 2Z" clipRule="evenodd" />
            </svg>
          </div>
          <div>
            <p className="text-sm font-medium text-text-primary">Nederīga saite</p>
            <p className="mt-1 text-sm text-text-secondary">
              Šī paroles atiestatīšanas saite nav derīga.
            </p>
          </div>
          <Link href="/forgot-password" className="inline-block text-sm font-medium text-primary hover:text-primary-hover">
            Pieprasīt jaunu saiti →
          </Link>
        </div>
      )}

      {/* Password reset successful */}
      {submitState === "success" && (
        <div className="space-y-4 text-center">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-green-900/20">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="h-6 w-6 text-green-400">
              <path fillRule="evenodd" d="M16.704 4.153a.75.75 0 0 1 .143 1.052l-8 10.5a.75.75 0 0 1-1.127.075l-4.5-4.5a.75.75 0 0 1 1.06-1.06l3.894 3.893 7.48-9.817a.75.75 0 0 1 1.05-.143Z" clipRule="evenodd" />
            </svg>
          </div>
          <div>
            <p className="text-sm font-medium text-text-primary">Parole nomainīta!</p>
            <p className="mt-1 text-sm text-text-secondary">
              Tiek novirzīts uz pieteikšanos...
            </p>
          </div>
        </div>
      )}

      {/* Valid token — show the form */}
      {tokenState === "valid" && submitState !== "success" && (
        <>
          {maskedEmail && (
            <p className="text-sm text-text-secondary">
              Iestatām jaunu paroli kontam <strong className="text-text-primary">{maskedEmail}</strong>.
            </p>
          )}

          {errorMsg && (
            <div className="rounded-lg bg-red-900/20 px-4 py-3 text-sm text-red-400 border border-red-900/30">
              {errorMsg}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label htmlFor="password" className="block text-sm font-medium text-text-secondary">
                Jaunā parole
              </label>
              <input
                id="password"
                type="password"
                required
                autoComplete="new-password"
                minLength={8}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className={inputClass}
                placeholder="Vismaz 8 simboli"
              />
            </div>

            <div>
              <label htmlFor="password-confirm" className="block text-sm font-medium text-text-secondary">
                Apstiprini paroli
              </label>
              <input
                id="password-confirm"
                type="password"
                required
                autoComplete="new-password"
                value={passwordConfirm}
                onChange={(e) => setPasswordConfirm(e.target.value)}
                className={inputClass}
                placeholder="••••••••"
              />
            </div>

            <button
              type="submit"
              disabled={submitState === "submitting"}
              className="w-full rounded-lg bg-primary px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-primary-hover focus:outline-none focus:ring-2 focus:ring-primary/50 focus:ring-offset-2 focus:ring-offset-base disabled:opacity-50"
            >
              {submitState === "submitting" ? (
                <span className="flex items-center justify-center gap-2">
                  <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                  Saglabā...
                </span>
              ) : (
                "Iestatīt jauno paroli"
              )}
            </button>
          </form>
        </>
      )}
    </div>
  );
}
