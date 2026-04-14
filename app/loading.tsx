// Root-level loading skeleton — shown during route transitions outside the
// chat/dashboard (e.g. payment/success, legal pages). Keeps the screen dark
// and consistent instead of flashing a blank page.

export default function Loading() {
  return (
    <div className="flex min-h-full items-center justify-center bg-base px-4 py-12">
      <div className="w-full max-w-sm space-y-4">
        {/* Simulate a card */}
        <div className="rounded-2xl border border-border bg-surface/50 p-8 space-y-4">
          <div className="skeleton h-10 w-10 rounded-xl mx-auto" />
          <div className="skeleton h-5 w-40 mx-auto" />
          <div className="skeleton h-4 w-56 mx-auto" />
          <div className="skeleton h-4 w-48 mx-auto" />
          <div className="skeleton h-10 w-full rounded-lg mt-2" />
        </div>
      </div>
    </div>
  );
}
