"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/context/auth-context";

export default function VerifyEmailPage() {
  const { user, loading, reloadUser, sendVerificationEmail } = useAuth();
  const router = useRouter();

  const [checking, setChecking] = useState(false);
  const [resending, setResending] = useState(false);
  const [resendCooldown, setResendCooldown] = useState(0);
  const [checkError, setCheckError] = useState<string | null>(null);
  const [resendSuccess, setResendSuccess] = useState(false);

  // If not logged in, go to login; if already verified, go to app
  useEffect(() => {
    if (loading) return;
    if (!user) {
      router.replace("/login");
      return;
    }
    if (user.emailVerified) {
      router.replace("/");
    }
  }, [user, loading, router]);

  // Cooldown countdown tick
  useEffect(() => {
    if (resendCooldown <= 0) return;
    const timer = setTimeout(() => setResendCooldown((s) => s - 1), 1000);
    return () => clearTimeout(timer);
  }, [resendCooldown]);

  const handleCheckVerified = async () => {
    setCheckError(null);
    setChecking(true);
    try {
      await reloadUser();
      // After reload, auth state updates — the useEffect above will redirect if verified.
      // If still not verified, show a message.
      const current = user;
      if (current && !current.emailVerified) {
        setCheckError("E-pasts vēl nav apstiprināts. Lūdzu, pārbaudiet iesūtni.");
      }
    } catch {
      setCheckError("Kaut kas nogāja greizi. Mēģini vēlreiz.");
    } finally {
      setChecking(false);
    }
  };

  const handleResend = async () => {
    if (resendCooldown > 0) return;
    setResending(true);
    setResendSuccess(false);
    try {
      await sendVerificationEmail();
      setResendSuccess(true);
      setResendCooldown(60);
    } catch {
      // Firebase throttles resends — surface a gentle message
      setCheckError("Neizdevās nosūtīt e-pastu. Mēģini vēlreiz pēc brīža.");
    } finally {
      setResending(false);
    }
  };

  if (loading || !user || user.emailVerified) {
    // Brief loading state while redirects resolve
    return (
      <div className="flex h-full items-center justify-center bg-base">
        <div className="w-6 h-6 rounded-full border-2 border-primary border-t-transparent animate-spin" />
      </div>
    );
  }

  return (
    <div className="flex min-h-full items-center justify-center bg-base px-4 py-12">
      <div className="w-full max-w-sm">
        <div className="rounded-2xl border border-border bg-surface/50 p-6 shadow-xl shadow-black/20 space-y-6 text-center">
          {/* Icon */}
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
              className="h-7 w-7 text-primary"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M21.75 6.75v10.5a2.25 2.25 0 0 1-2.25 2.25h-15a2.25 2.25 0 0 1-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0 0 19.5 4.5h-15a2.25 2.25 0 0 0-2.25 2.25m19.5 0v.243a2.25 2.25 0 0 1-1.07 1.916l-7.5 4.615a2.25 2.25 0 0 1-2.36 0L3.32 8.91a2.25 2.25 0 0 1-1.07-1.916V6.75"
              />
            </svg>
          </div>

          {/* Heading */}
          <div>
            <h1 className="text-lg font-semibold text-text-primary">
              Apstipriniet e-pastu
            </h1>
            <p className="mt-2 text-sm text-text-secondary leading-relaxed">
              Pārbaudiet savu e-pastu un apstipriniet kontu, lai turpinātu.
            </p>
            <p className="mt-1 text-xs text-text-muted">
              Sūtīts uz{" "}
              <span className="font-medium text-text-secondary">{user.email}</span>
            </p>
          </div>

          {/* Feedback messages */}
          {checkError && (
            <div className="rounded-lg bg-amber-900/20 border border-amber-900/30 px-4 py-3 text-sm text-amber-400">
              {checkError}
            </div>
          )}
          {resendSuccess && !checkError && (
            <div className="rounded-lg bg-green-900/20 border border-green-900/30 px-4 py-3 text-sm text-green-400">
              E-pasts nosūtīts! Pārbaudiet iesūtni.
            </div>
          )}

          {/* Primary CTA */}
          <button
            onClick={handleCheckVerified}
            disabled={checking}
            className="w-full rounded-lg bg-primary px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-primary-hover focus:outline-none focus:ring-2 focus:ring-primary/50 focus:ring-offset-2 focus:ring-offset-surface disabled:opacity-50"
          >
            {checking ? "Pārbauda..." : "Esmu apstiprinājis"}
          </button>

          {/* Resend link */}
          <p className="text-sm text-text-muted">
            Nav saņemts e-pasts?{" "}
            <button
              onClick={handleResend}
              disabled={resending || resendCooldown > 0}
              className="font-medium text-primary hover:text-primary-hover disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {resendCooldown > 0
                ? `Nosūtīt vēlreiz (${resendCooldown}s)`
                : resending
                ? "Sūta..."
                : "Nosūtīt vēlreiz"}
            </button>
          </p>
        </div>

        <p className="mt-6 text-center text-xs text-text-muted">
          SkolnieksAI · Skola2030 programma
        </p>
      </div>
    </div>
  );
}
