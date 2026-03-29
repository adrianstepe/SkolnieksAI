"use client";

import { useEffect } from "react";
import Link from "next/link";
import { ChatContainer } from "@/components/chat/ChatContainer";
import { InteractiveDemo } from "@/components/landing/InteractiveDemo";
import { LogoWordmark } from "@/components/LogoWordmark";
import { useAuth } from "@/lib/context/auth-context";

// ── Icons ──────────────────────────────────────────────────────────────────

function ShieldCheckIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
      <polyline points="9 12 11 14 15 10" />
    </svg>
  );
}

function StarIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
    </svg>
  );
}

function BookIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
      <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
    </svg>
  );
}

// ── Loading skeleton ───────────────────────────────────────────────────────

function LoadingSkeleton() {
  return (
    <main className="flex h-full bg-base">
      <div className="hidden lg:block w-64 shrink-0 border-r border-subtle bg-sidebar p-5 space-y-4">
        <div className="skeleton h-8 w-32" />
        <div className="space-y-2 mt-6">
          <div className="skeleton h-4 w-20" />
          <div className="skeleton h-8 w-full" />
          <div className="skeleton h-8 w-full" />
          <div className="skeleton h-8 w-full" />
          <div className="skeleton h-8 w-full" />
        </div>
      </div>
      <div className="flex-1 flex flex-col">
        <div className="h-[52px] border-b border-border bg-topbar px-5 flex items-center gap-3">
          <div className="skeleton h-7 w-40" />
          <div className="skeleton h-7 w-24" />
        </div>
        <div className="flex-1 bg-chat-bg p-6">
          <div className="mx-auto max-w-3xl space-y-4 mt-8">
            <div className="skeleton h-16 w-16 mx-auto rounded-2xl" />
            <div className="skeleton h-6 w-48 mx-auto" />
            <div className="skeleton h-4 w-64 mx-auto" />
          </div>
        </div>
      </div>
    </main>
  );
}

// ── Landing page (unauthenticated) ─────────────────────────────────────────

function LandingPage() {
  return (
    <>
      {/* ── Navbar ── */}
      <header className="sticky top-0 z-40 border-b border-border bg-base/80 backdrop-blur-md">
        <div className="mx-auto flex h-14 max-w-5xl items-center justify-between px-4">
          <LogoWordmark size="md" />
          <nav className="flex items-center gap-3">
            <Link
              href="/login"
              className="rounded-lg px-3 py-2 text-sm text-text-secondary hover:text-text-primary transition-colors min-h-[44px] flex items-center"
            >
              Ieiet
            </Link>
            <Link
              href="/signup"
              className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-primary-hover transition-colors min-h-[44px] flex items-center"
            >
              Reģistrēties
            </Link>
          </nav>
        </div>
      </header>

      {/* ── Main content ── */}
      <main className="pb-28 md:pb-0">
        {/* ── Hero — above the fold ── */}
        <section className="mx-auto max-w-2xl px-4 pt-14 pb-12 text-center">
          {/* Badge */}
          <div className="mb-5 inline-flex items-center gap-1.5 rounded-full border border-[#2563EB]/30 bg-[#2563EB]/10 px-3 py-1 text-xs font-medium text-[#4F8EF7]">
            <span className="h-1.5 w-1.5 rounded-full bg-[#22C55E] animate-pulse-glow" />
            Latvijas pirmais AI mācību palīgs
          </div>

          {/* Headline */}
          <h1 className="text-4xl font-bold leading-tight tracking-tight text-text-primary sm:text-5xl">
            Saproti mācības ātrāk.{" "}
            <span className="text-[#2563EB]">Bez stresa.</span>
          </h1>

          {/* Subheadline */}
          <p className="mt-5 text-base text-text-secondary sm:text-lg leading-relaxed max-w-xl mx-auto">
            Latvijas pirmais mākslīgais intelekts, kas palīdz tev saprast mācības
            — nevis izdara tās tavā vietā. Balstīts uz Skola2030.
          </p>

          {/* Desktop CTA — hidden on mobile (replaced by sticky bottom bar) */}
          <div className="mt-8 hidden md:flex items-center justify-center gap-4">
            <Link
              href="/signup"
              className="rounded-xl bg-[#2563EB] px-7 py-3.5 text-base font-semibold text-white hover:bg-[#1d4ed8] transition-colors shadow-[0_0_24px_rgba(37,99,235,0.4)] min-h-[48px] flex items-center"
            >
              Sākt mācīties bez maksas →
            </Link>
            <Link
              href="/login"
              className="rounded-xl border border-border px-6 py-3.5 text-base text-text-secondary hover:text-text-primary hover:border-[rgba(255,255,255,0.14)] transition-colors min-h-[48px] flex items-center"
            >
              Pierakstīties
            </Link>
          </div>
        </section>

        {/* ── Interactive demo ── */}
        <section className="border-t border-border bg-sidebar/40 py-12">
          <InteractiveDemo />
        </section>

        {/* ── Trust signals ── */}
        <section className="mx-auto max-w-2xl px-4 py-12">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            {/* Signal 1 */}
            <div className="flex items-start gap-3 rounded-xl border border-border bg-surface/50 px-4 py-4 min-h-[72px]">
              <span className="shrink-0 text-[#22C55E] mt-0.5">
                <ShieldCheckIcon />
              </span>
              <div>
                <p className="text-sm font-medium text-text-primary leading-snug">
                  Balstīts uz Skola2030
                </p>
                <p className="text-xs text-text-secondary mt-0.5">
                  Atbilstoši Latvijas mācību programmai
                </p>
              </div>
            </div>

            {/* Signal 2 */}
            <div className="flex items-start gap-3 rounded-xl border border-border bg-surface/50 px-4 py-4 min-h-[72px]">
              <span className="shrink-0 text-[#2563EB] mt-0.5">
                <StarIcon />
              </span>
              <div>
                <p className="text-sm font-medium text-text-primary leading-snug">
                  Latviešu valoda
                </p>
                <p className="text-xs text-text-secondary mt-0.5">
                  Izskaidro latviski, skaidri un vienkārši
                </p>
              </div>
            </div>

            {/* Signal 3 */}
            <div className="flex items-start gap-3 rounded-xl border border-border bg-surface/50 px-4 py-4 min-h-[72px]">
              <span className="shrink-0 text-[#22C55E] mt-0.5">
                <BookIcon />
              </span>
              <div>
                <p className="text-sm font-medium text-text-primary leading-snug">
                  Matemātika, Fizika, Ķīmija, Vēsture un vēl
                </p>
                <p className="text-xs text-text-secondary mt-0.5">
                  6.–12. klase
                </p>
              </div>
            </div>
          </div>
        </section>
      </main>

      {/* ── Sticky bottom CTA — mobile only (max-width: 768px) ── */}
      <div className="fixed bottom-0 left-0 right-0 z-50 md:hidden border-t border-border bg-base/95 backdrop-blur-md px-4 py-3 safe-area-bottom">
        <Link
          href="/signup"
          className="block w-full rounded-xl bg-[#2563EB] py-3.5 text-center text-base font-semibold text-white hover:bg-[#1d4ed8] transition-colors shadow-[0_0_24px_rgba(37,99,235,0.35)] min-h-[52px] flex items-center justify-center"
        >
          Sākt mācīties bez maksas →
        </Link>
      </div>
    </>
  );
}

// ── Page entry point ───────────────────────────────────────────────────────

export default function Home() {
  const { user, loading } = useAuth();

  // Authenticated users: stay on "/" and see the chat app
  // No redirect needed — ChatContainer renders below

  if (loading) return <LoadingSkeleton />;
  if (user) {
    return (
      <main className="h-full">
        <ChatContainer />
      </main>
    );
  }

  return (
    <div className="min-h-full bg-base">
      <LandingPage />
    </div>
  );
}
