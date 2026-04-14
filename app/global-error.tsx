"use client";

// global-error.tsx replaces the entire root layout when it fires — must
// include <html> and <body> with the dark theme inlined (no CSS vars).

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="lv" className="dark h-full antialiased">
      <body className="h-full bg-[#0F1117] text-[#E8ECF4] font-sans">
        <div className="flex min-h-full items-center justify-center px-4 py-12">
          <div className="w-full max-w-md animate-fade-up">
            <div className="rounded-2xl border border-white/[0.07] bg-[#1A2033]/50 p-8 shadow-xl shadow-black/20 text-center space-y-5">
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
                <h1
                  className="text-xl font-semibold text-[#E8ECF4]"
                  style={{ fontFamily: "var(--font-sora, sans-serif)" }}
                >
                  Kaut kas nogāja greizi
                </h1>
                <p className="text-sm text-[#8B95A8]">
                  Radās neparedzēta kļūda. Mēģini vēlreiz vai atgriezies
                  sākumlapā.
                </p>
                {error.digest && (
                  <p className="text-xs text-[#5A6478] font-mono">
                    Kļūdas kods: {error.digest}
                  </p>
                )}
              </div>

              {/* Actions */}
              <div className="flex flex-col gap-3 sm:flex-row sm:justify-center">
                <button
                  onClick={reset}
                  className="rounded-lg bg-[#4F8EF7] px-5 py-2.5 text-sm font-medium text-white transition-colors hover:bg-[#3D7CE5] focus:outline-none focus:ring-2 focus:ring-[#4F8EF7]/50 focus:ring-offset-2 focus:ring-offset-[#0F1117]"
                >
                  Mēģināt vēlreiz
                </button>
                <a
                  href="/"
                  className="rounded-lg border border-white/[0.07] bg-[#1A2033] px-5 py-2.5 text-sm font-medium text-[#8B95A8] transition-colors hover:bg-[#222940] hover:text-[#E8ECF4] focus:outline-none focus:ring-2 focus:ring-[#4F8EF7]/50 focus:ring-offset-2 focus:ring-offset-[#0F1117]"
                >
                  Uz sākuma lapu
                </a>
              </div>
            </div>
          </div>
        </div>
      </body>
    </html>
  );
}
