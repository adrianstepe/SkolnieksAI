"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { ChatContainer } from "@/components/chat/ChatContainer";
import { useAuth } from "@/lib/context/auth-context";

export default function Home() {
  const { user, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && !user) {
      router.replace("/login");
    }
  }, [user, loading, router]);

  if (loading) {
    return (
      <main className="flex h-full bg-base">
        {/* Sidebar skeleton — hidden on mobile */}
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
        {/* Main area skeleton */}
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

  if (!user) return null;

  return (
    <main className="h-full">
      <ChatContainer />
    </main>
  );
}
