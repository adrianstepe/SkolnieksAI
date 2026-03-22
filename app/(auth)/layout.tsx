"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/context/auth-context";

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { user, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && user) {
      router.replace("/");
    }
  }, [user, loading, router]);

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center bg-base">
        <div className="w-full max-w-sm space-y-4 px-4">
          <div className="skeleton mx-auto h-8 w-40" />
          <div className="skeleton h-4 w-32 mx-auto" />
          <div className="space-y-3 mt-8">
            <div className="skeleton h-10 w-full" />
            <div className="skeleton h-10 w-full" />
            <div className="skeleton h-10 w-full" />
          </div>
        </div>
      </div>
    );
  }

  if (user) return null;

  return (
    <div className="flex min-h-full items-center justify-center bg-base px-4 py-12">
      <div className="w-full max-w-sm">
        <div className="rounded-2xl border border-border bg-surface/50 p-6 shadow-xl shadow-black/20">
          {children}
        </div>
        <p className="mt-6 text-center text-xs text-text-muted">
          SkolnieksAI · Skola2030 programma
        </p>
      </div>
    </div>
  );
}
