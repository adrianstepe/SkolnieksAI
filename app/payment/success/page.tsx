"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

export default function PaymentSuccessPage() {
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
        <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-full bg-primary/20">
          <svg
            className="h-8 w-8 text-primary"
            fill="currentColor"
            viewBox="0 0 20 20"
          >
            <path
              fillRule="evenodd"
              d="M16.704 4.153a.75.75 0 0 1 .143 1.052l-8 10.5a.75.75 0 0 1-1.127.075l-4.5-4.5a.75.75 0 0 1 1.06-1.06l3.894 3.893 7.48-9.817a.75.75 0 0 1 1.05-.143Z"
              clipRule="evenodd"
            />
          </svg>
        </div>

        <h1 className="text-2xl font-bold text-text-primary">
          Maksājums veiksmīgs!
        </h1>
        <p className="mt-2 text-text-secondary">
          Tavs plāns ir aktivizēts. Tagad tev ir pieejamas visas premium
          funkcijas.
        </p>

        <p className="mt-6 text-sm text-text-muted">
          Pāradresēšana pēc {countdown} sekundēm...
        </p>

        <button
          onClick={() => router.push("/")}
          className="mt-4 rounded-lg bg-primary px-6 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-primary-hover"
        >
          Atgriezties uz čatu
        </button>
      </div>
    </div>
  );
}
