"use client";

import { ChatContainer } from "@/components/chat/ChatContainer";
import { Navbar } from "@/components/landing/Navbar";
import { Hero } from "@/components/landing/Hero";
import { InteractiveDemo } from "@/components/landing/InteractiveDemo";
import { HowItWorks } from "@/components/landing/HowItWorks";
import { SubjectGrid } from "@/components/landing/SubjectGrid";
import { Pricing } from "@/components/landing/Pricing";
import { FAQ } from "@/components/landing/FAQ";
import { FinalCTA } from "@/components/landing/FinalCTA";
import { Footer } from "@/components/landing/Footer";
import { useAuth } from "@/lib/context/auth-context";

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
    <div className="min-h-screen bg-base text-white selection:bg-primary/30 selection:text-white">
      <Navbar />
      <main className="pb-28 md:pb-0">
        <Hero />
        <InteractiveDemo />
        <HowItWorks />
        <SubjectGrid />
        <Pricing />
        <FAQ />
        <FinalCTA />
      </main>
      <Footer />
    </div>
  );
}

// ── Page entry point ───────────────────────────────────────────────────────

export default function Home() {
  const { user, loading } = useAuth();

  if (loading) return <LoadingSkeleton />;
  if (user) {
    return (
      <main className="h-full">
        <ChatContainer />
      </main>
    );
  }

  return <LandingPage />;
}
