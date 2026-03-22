"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

export default function PaymentCancelPage() {
  const router = useRouter();
  const [countdown, setCountdown] = useState(3);

  useEffect(() => {
    const timer = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          router.push("/");
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [router]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-base">
      <div className="mx-4 max-w-md text-center animate-fade-up">
        <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-full bg-surface">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 20 20"
            fill="currentColor"
            className="h-8 w-8 text-text-muted"
          >
            <path d="M6.28 5.22a.75.75 0 0 0-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 1 0 1.06 1.06L10 11.06l3.72 3.72a.75.75 0 1 0 1.06-1.06L11.06 10l3.72-3.72a.75.75 0 0 0-1.06-1.06L10 8.94 6.28 5.22Z" />
          </svg>
        </div>

        <h1 className="text-2xl font-bold text-text-primary">
          Maksājums atcelts
        </h1>
        <p className="mt-2 text-text-secondary">
          Maksājums netika veikts. Tu vari mēģināt vēlreiz jebkurā laikā.
        </p>

        <p className="mt-6 text-sm text-text-muted">
          Pāradresēšana pēc {countdown} sekundēm...
        </p>

        <button
          onClick={() => router.push("/")}
          className="mt-4 rounded-lg bg-surface px-6 py-2.5 text-sm font-semibold text-text-primary transition-colors hover:bg-surface-hover"
        >
          Atgriezties uz čatu
        </button>
      </div>
    </div>
  );
}
