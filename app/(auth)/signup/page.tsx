"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/context/auth-context";

export default function SignupPage() {
  const { signUpWithEmail, signInWithGoogle, getIdToken } = useAuth();
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [passwordConfirm, setPasswordConfirm] = useState("");
  const [inviteCode, setInviteCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const registerInFirestore = async (token: string) => {
    await fetch("/api/auth/register", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        ...(inviteCode ? { inviteCode } : {}),
      }),
    });
  };

  const handleEmailSignup = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);

    if (password !== passwordConfirm) {
      setError("Paroles nesakrīt.");
      return;
    }
    if (password.length < 6) {
      setError("Parolei jābūt vismaz 6 simbolus garai.");
      return;
    }

    setSubmitting(true);
    try {
      const user = await signUpWithEmail(email, password);
      const token = await user.getIdToken();
      await registerInFirestore(token);
      router.replace("/");
    } catch (err) {
      setError(mapFirebaseError(err));
    } finally {
      setSubmitting(false);
    }
  };

  const handleGoogleSignup = async () => {
    setError(null);
    setSubmitting(true);
    try {
      await signInWithGoogle();
      const token = await getIdToken();
      if (token) {
        await registerInFirestore(token);
      }
      router.replace("/");
    } catch (err) {
      setError(mapFirebaseError(err));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="text-center">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-slate-100">
          Skolnieks<span className="text-brand-600">AI</span>
        </h1>
        <p className="mt-1 text-sm text-gray-500 dark:text-slate-400">
          Izveido jaunu kontu
        </p>
      </div>

      {error && (
        <div className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700 dark:bg-red-900/20 dark:text-red-400">
          {error}
        </div>
      )}

      <form onSubmit={handleEmailSignup} className="space-y-4">
        <div>
          <label
            htmlFor="email"
            className="block text-sm font-medium text-gray-700 dark:text-slate-300"
          >
            E-pasts
          </label>
          <input
            id="email"
            type="email"
            required
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
            placeholder="tavs@epasts.lv"
          />
        </div>

        <div>
          <label
            htmlFor="password"
            className="block text-sm font-medium text-gray-700 dark:text-slate-300"
          >
            Parole
          </label>
          <input
            id="password"
            type="password"
            required
            autoComplete="new-password"
            minLength={6}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
            placeholder="Vismaz 6 simboli"
          />
        </div>

        <div>
          <label
            htmlFor="password-confirm"
            className="block text-sm font-medium text-gray-700 dark:text-slate-300"
          >
            Apstiprini paroli
          </label>
          <input
            id="password-confirm"
            type="password"
            required
            autoComplete="new-password"
            value={passwordConfirm}
            onChange={(e) => setPasswordConfirm(e.target.value)}
            className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
            placeholder="••••••••"
          />
        </div>

        <div>
          <label
            htmlFor="invite"
            className="block text-sm font-medium text-gray-700 dark:text-slate-300"
          >
            Uzaicinājuma kods{" "}
            <span className="font-normal text-gray-400">(neobligāts)</span>
          </label>
          <input
            id="invite"
            type="text"
            maxLength={20}
            value={inviteCode}
            onChange={(e) => setInviteCode(e.target.value.toUpperCase())}
            className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
            placeholder="Piemēram, AB12CD34"
          />
        </div>

        <button
          type="submit"
          disabled={submitting}
          className="w-full rounded-lg bg-brand-600 px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-brand-700 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:ring-offset-2 disabled:opacity-50 dark:focus:ring-offset-slate-900"
        >
          {submitting ? "Reģistrē..." : "Reģistrēties"}
        </button>
      </form>

      <div className="relative">
        <div className="absolute inset-0 flex items-center">
          <div className="w-full border-t border-gray-200 dark:border-slate-700" />
        </div>
        <div className="relative flex justify-center text-sm">
          <span className="bg-gray-50 px-2 text-gray-500 dark:bg-slate-900 dark:text-slate-400">
            vai
          </span>
        </div>
      </div>

      <button
        onClick={handleGoogleSignup}
        disabled={submitting}
        className="flex w-full items-center justify-center gap-2 rounded-lg border border-gray-300 bg-white px-4 py-2.5 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:ring-offset-2 disabled:opacity-50 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700 dark:focus:ring-offset-slate-900"
      >
        <svg className="h-5 w-5" viewBox="0 0 24 24" aria-hidden="true">
          <path
            d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z"
            fill="#4285F4"
          />
          <path
            d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
            fill="#34A853"
          />
          <path
            d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
            fill="#FBBC05"
          />
          <path
            d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
            fill="#EA4335"
          />
        </svg>
        Reģistrēties ar Google
      </button>

      <p className="text-center text-sm text-gray-500 dark:text-slate-400">
        Jau ir konts?{" "}
        <Link
          href="/login"
          className="font-medium text-brand-600 hover:text-brand-500"
        >
          Ienākt
        </Link>
      </p>
    </div>
  );
}

function mapFirebaseError(err: unknown): string {
  const code = (err as { code?: string }).code ?? "";
  switch (code) {
    case "auth/email-already-in-use":
      return "Šis e-pasts jau ir reģistrēts.";
    case "auth/invalid-email":
      return "Nepareizs e-pasta formāts.";
    case "auth/weak-password":
      return "Parole ir pārāk vienkārša.";
    case "auth/popup-closed-by-user":
      return "Google reģistrācija tika atcelta.";
    default:
      return "Kaut kas nogāja greizi. Mēģini vēlreiz.";
  }
}
