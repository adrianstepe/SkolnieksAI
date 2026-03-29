"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/context/auth-context";
import { LogoWordmark } from "@/components/LogoWordmark";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Returns the current calendar year. */
function currentYear(): number {
  return new Date().getFullYear();
}

/** Birth years available in the dropdown — 2026 down to 2006 (ages 0–20). */
function birthYearOptions(): number[] {
  const years: number[] = [];
  for (let y = 2026; y >= 2006; y--) years.push(y);
  return years;
}

/** Calculate age based on birth year only (conservative: assume not yet had birthday). */
function calcAge(birthYear: number): number {
  return currentYear() - birthYear;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function SignupPage() {
  const { signUpWithEmail, signInWithGoogle, getIdToken } = useAuth();
  const router = useRouter();

  // --- Form state ---
  const [birthYear, setBirthYear] = useState<number | "">("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [passwordConfirm, setPasswordConfirm] = useState("");
  const [inviteCode, setInviteCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // --- Parental consent flow state ---
  const [showParentalFlow, setShowParentalFlow] = useState(false);
  const [parentEmail, setParentEmail] = useState("");
  const [childName, setChildName] = useState("");
  const [consentSent, setConsentSent] = useState(false);
  const [consentError, setConsentError] = useState<string | null>(null);
  const [consentSubmitting, setConsentSubmitting] = useState(false);

  // ---------------------------------------------------------------------------
  // Register in Firestore after Firebase Auth succeeds
  // ---------------------------------------------------------------------------
  const registerInFirestore = async (token: string) => {
    await fetch("/api/auth/register", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        ...(inviteCode ? { inviteCode } : {}),
        ...(birthYear !== "" ? { birthYear: birthYear as number } : {}),
      }),
    });
  };

  // ---------------------------------------------------------------------------
  // Email signup handler
  // ---------------------------------------------------------------------------
  const handleEmailSignup = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);

    if (birthYear === "") {
      setError("Lūdzu izvēlies savu dzimšanas gadu.");
      return;
    }

    const age = calcAge(birthYear as number);

    // Under-13: redirect to parental consent screen instead of creating account
    if (age < 13) {
      setShowParentalFlow(true);
      return;
    }

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

  // ---------------------------------------------------------------------------
  // Google signup handler
  // ---------------------------------------------------------------------------
  const handleGoogleSignup = async () => {
    setError(null);

    if (birthYear === "") {
      setError("Lūdzu izvēlies savu dzimšanas gadu pirms reģistrācijas ar Google.");
      return;
    }

    const age = calcAge(birthYear as number);

    if (age < 13) {
      setShowParentalFlow(true);
      return;
    }

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

  // ---------------------------------------------------------------------------
  // Parental consent submit handler
  // ---------------------------------------------------------------------------
  const handleConsentSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setConsentError(null);

    if (!parentEmail || !childName) {
      setConsentError("Lūdzu aizpildi visus laukus.");
      return;
    }

    setConsentSubmitting(true);
    try {
      const res = await fetch("/api/auth/parental-consent", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          childName,
          parentEmail,
          birthYear: birthYear as number,
        }),
      });

      if (!res.ok) {
        throw new Error("server_error");
      }

      setConsentSent(true);
    } catch {
      setConsentError("Kaut kas nogāja greizi. Mēģini vēlreiz.");
    } finally {
      setConsentSubmitting(false);
    }
  };

  // ---------------------------------------------------------------------------
  // Shared styles
  // ---------------------------------------------------------------------------
  const inputClass =
    "mt-1 block w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm text-text-primary placeholder:text-text-muted focus:border-primary/40 focus:outline-none focus:ring-1 focus:ring-primary/20";

  // ---------------------------------------------------------------------------
  // Parental consent screen (age < 13)
  // ---------------------------------------------------------------------------
  if (showParentalFlow) {
    if (consentSent) {
      return (
        <div className="space-y-6 text-center">
          <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-xl bg-green-500/10">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="h-6 w-6 text-green-500">
              <path fillRule="evenodd" d="M16.704 4.153a.75.75 0 0 1 .143 1.052l-8 10.5a.75.75 0 0 1-1.127.075l-4.5-4.5a.75.75 0 0 1 1.06-1.06l3.894 3.893 7.48-9.817a.75.75 0 0 1 1.05-.143Z" clipRule="evenodd" />
            </svg>
          </div>
          <h1 className="text-lg font-semibold text-text-primary">E-pasts nosūtīts!</h1>
          <p className="text-sm text-text-secondary">
            Lūdzu, lūdz vecākus apstiprināt reģistrāciju. Kad vecāks apstiprinās, varēsi pieteikties.
          </p>
          <Link
            href="/login"
            className="inline-block text-sm font-medium text-primary hover:text-primary-hover"
          >
            Doties uz pieteikšanos →
          </Link>
        </div>
      );
    }

    return (
      <div className="space-y-6">
        <div className="text-center">
          <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-xl bg-amber-500/10">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="h-6 w-6 text-amber-500">
              <path fillRule="evenodd" d="M18 10a8 8 0 1 1-16 0 8 8 0 0 1 16 0Zm-7-4a1 1 0 1 1-2 0 1 1 0 0 1 2 0ZM9 9a.75.75 0 0 0 0 1.5h.253a.25.25 0 0 1 .244.304l-.459 2.066A1.75 1.75 0 0 0 10.747 15H11a.75.75 0 0 0 0-1.5h-.253a.25.25 0 0 1-.244-.304l.459-2.066A1.75 1.75 0 0 0 9.253 9H9Z" clipRule="evenodd" />
            </svg>
          </div>
          <h1 className="text-lg font-semibold text-text-primary">
            Vecāku atļauja nepieciešama
          </h1>
          <p className="mt-2 text-sm text-text-secondary leading-relaxed">
            Saskaņā ar Latvijas datu aizsardzības likumu, lietotājiem līdz 13 gadu vecumam
            nepieciešama vecāku piekrišana. Lūdzu, ievadi vecāka vai aizbildņa e-pasta adresi.
          </p>
        </div>

        {consentError && (
          <div className="rounded-lg bg-red-900/20 px-4 py-3 text-sm text-red-400 border border-red-900/30">
            {consentError}
          </div>
        )}

        <form onSubmit={handleConsentSubmit} className="space-y-4">
          <div>
            <label htmlFor="child-name" className="block text-sm font-medium text-text-secondary">
              Tavs vārds
            </label>
            <input
              id="child-name"
              type="text"
              required
              value={childName}
              onChange={(e) => setChildName(e.target.value)}
              className={inputClass}
              placeholder="Piemēram, Jānis"
            />
          </div>

          <div>
            <label htmlFor="parent-email" className="block text-sm font-medium text-text-secondary">
              Vecāka/aizbildņa e-pasts
            </label>
            <input
              id="parent-email"
              type="email"
              required
              value={parentEmail}
              onChange={(e) => setParentEmail(e.target.value)}
              className={inputClass}
              placeholder="vecaks@epasts.lv"
            />
          </div>

          <button
            id="send-parental-consent"
            type="submit"
            disabled={consentSubmitting}
            className="w-full rounded-lg bg-primary px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-primary-hover focus:outline-none focus:ring-2 focus:ring-primary/50 focus:ring-offset-2 focus:ring-offset-base disabled:opacity-50"
          >
            {consentSubmitting ? "Sūta..." : "Nosūtīt atļaujas pieprasījumu"}
          </button>
        </form>

        <button
          onClick={() => setShowParentalFlow(false)}
          className="w-full text-center text-sm text-text-muted hover:text-text-secondary"
        >
          ← Atpakaļ uz reģistrāciju
        </button>
      </div>
    );
  }

  // ---------------------------------------------------------------------------
  // Main signup form
  // ---------------------------------------------------------------------------
  return (
    <div className="space-y-6">
      <div className="text-center">
        <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-xl bg-primary">
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="white" className="h-6 w-6">
            <path d="M10.362 1.093a.75.75 0 0 0-.724 0L2.523 5.018 10 9.143l7.477-4.125-7.115-3.925ZM18 6.443l-7.25 4v8.25l6.862-3.786A.75.75 0 0 0 18 14.25V6.443ZM9.25 18.693v-8.25l-7.25-4v7.807a.75.75 0 0 0 .388.657l6.862 3.786Z" />
          </svg>
        </div>
        <h1 className="flex justify-center">
          <LogoWordmark size="lg" />
        </h1>
        <p className="mt-1 text-sm text-text-secondary">Izveido jaunu kontu</p>
      </div>

      {error && (
        <div className="rounded-lg bg-red-900/20 px-4 py-3 text-sm text-red-400 border border-red-900/30">
          {error}
        </div>
      )}

      <form onSubmit={handleEmailSignup} className="space-y-4">
        {/* Birth year — FIRST field, required for GDPR age gating */}
        <div>
          <label htmlFor="birth-year" className="block text-sm font-medium text-text-secondary">
            Dzimšanas gads <span className="text-red-500">*</span>
          </label>
          <select
            id="birth-year"
            required
            value={birthYear}
            onChange={(e) => setBirthYear(e.target.value === "" ? "" : Number(e.target.value))}
            className={inputClass}
          >
            <option value="">— Izvēlies gadu —</option>
            {birthYearOptions().map((y) => (
              <option key={y} value={y}>
                {y}
              </option>
            ))}
          </select>
        </div>

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

        <div>
          <label htmlFor="password" className="block text-sm font-medium text-text-secondary">
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
            className={inputClass}
            placeholder="Vismaz 6 simboli"
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

        <div>
          <label htmlFor="invite" className="block text-sm font-medium text-text-secondary">
            Uzaicinājuma kods{" "}
            <span className="font-normal text-text-muted">(neobligāts)</span>
          </label>
          <input
            id="invite"
            type="text"
            maxLength={20}
            value={inviteCode}
            onChange={(e) => setInviteCode(e.target.value.toUpperCase())}
            className={inputClass}
            placeholder="Piemēram, AB12CD34"
          />
        </div>

        <button
          id="signup-submit"
          type="submit"
          disabled={submitting}
          className="w-full rounded-lg bg-primary px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-primary-hover focus:outline-none focus:ring-2 focus:ring-primary/50 focus:ring-offset-2 focus:ring-offset-base disabled:opacity-50"
        >
          {submitting ? "Reģistrē..." : "Reģistrēties"}
        </button>
      </form>

      <div className="relative">
        <div className="absolute inset-0 flex items-center">
          <div className="w-full border-t border-border" />
        </div>
        <div className="relative flex justify-center text-sm">
          <span className="bg-base px-2 text-text-muted">vai</span>
        </div>
      </div>

      <button
        id="signup-google"
        onClick={handleGoogleSignup}
        disabled={submitting}
        className="flex w-full items-center justify-center gap-2 rounded-lg border border-border bg-surface px-4 py-2.5 text-sm font-medium text-text-secondary transition-colors hover:bg-surface-hover hover:text-text-primary focus:outline-none focus:ring-2 focus:ring-primary/50 focus:ring-offset-2 focus:ring-offset-base disabled:opacity-50"
      >
        <svg className="h-5 w-5" viewBox="0 0 24 24" aria-hidden="true">
          <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4" />
          <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
          <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
          <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
        </svg>
        Reģistrēties ar Google
      </button>

      <div className="mt-6 text-center text-xs text-text-muted">
        Reģistrējoties jūs piekrītat mūsu{" "}
        <Link href="/terms" className="underline hover:text-text-secondary">Lietošanas noteikumiem</Link>
        {" "}un{" "}
        <Link href="/privacy" className="underline hover:text-text-secondary">Privātuma politikai</Link>.
      </div>

      <p className="mt-2 text-center text-sm text-text-secondary">
        Jau ir konts?{" "}
        <Link href="/login" className="font-medium text-primary hover:text-primary-hover">
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
