import Link from "next/link";

export default function NotFound() {
  return (
    <div className="flex min-h-full items-center justify-center bg-base px-4 py-12">
      <div className="w-full max-w-md animate-fade-up text-center space-y-6">
        {/* Large 404 */}
        <p className="text-8xl font-heading font-semibold text-text-muted select-none">
          404
        </p>

        {/* Text */}
        <div className="space-y-2">
          <h1 className="text-2xl font-heading font-semibold text-text-primary">
            Lapa nav atrasta
          </h1>
          <p className="text-sm text-text-secondary">
            Šī lapa neeksistē vai ir pārvietota.
          </p>
        </div>

        {/* CTA */}
        <Link
          href="/"
          className="inline-block rounded-lg bg-primary px-6 py-2.5 text-sm font-medium text-white transition-colors hover:bg-primary-hover focus:outline-none focus:ring-2 focus:ring-primary/50 focus:ring-offset-2 focus:ring-offset-base"
        >
          Uz sākuma lapu
        </Link>
      </div>
    </div>
  );
}
