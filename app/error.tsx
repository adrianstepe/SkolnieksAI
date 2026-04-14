"use client";

// error.tsx catches errors in root-segment pages while keeping the root
// layout (fonts, providers, theme) intact — Tailwind CSS vars work here.

import Link from "next/link";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="flex min-h-full items-center justify-center bg-base px-4 py-12">
      <div className="w-full max-w-md animate-fade-up">
        <div className="rounded-2xl border border-border bg-surface/50 p-8 shadow-xl shadow-black/20 text-center space-y-5">
          {/* Icon */}
          <div className="flex justify-center">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-red-900/20 border border-red-900/30">
              <svg
                className="h-7 w-7 text-red-400"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={1.5}
                aria-hidden="true"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126ZM12 15.75h.007v.008H12v-.008Z"
                />
              </svg>
            </div>
          </div>

          {/* Text */}
          <div className="space-y-2">
            <h1 className="text-xl font-semibold font-heading text-text-primary">
              Kaut kas nogāja greizi
            </h1>
            <p className="text-sm text-text-secondary">
              Radās neparedzēta kļūda. Mēģini vēlreiz vai atgriezies
              sākumlapā.
            </p>
            {error.digest && (
              <p className="text-xs text-text-muted font-mono">
                Kļūdas kods: {error.digest}
              </p>
            )}
          </div>

          {/* Actions */}
          <div className="flex flex-col gap-3 sm:flex-row sm:justify-center">
            <button
              onClick={reset}
              className="rounded-lg bg-primary px-5 py-2.5 text-sm font-medium text-white transition-colors hover:bg-primary-hover focus:outline-none focus:ring-2 focus:ring-primary/50 focus:ring-offset-2 focus:ring-offset-base"
            >
              Mēģināt vēlreiz
            </button>
            <Link
              href="/"
              className="rounded-lg border border-border bg-surface px-5 py-2.5 text-sm font-medium text-text-secondary transition-colors hover:bg-surface-hover hover:text-text-primary focus:outline-none focus:ring-2 focus:ring-primary/50 focus:ring-offset-2 focus:ring-offset-base"
            >
              Uz sākuma lapu
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
