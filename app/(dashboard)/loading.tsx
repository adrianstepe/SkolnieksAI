// Dashboard loading skeleton — shown during navigations within the (dashboard)
// route group (settings pages, etc.). Mirrors the two-column chrome of the
// main chat layout so the transition feels intentional, not broken.

export default function DashboardLoading() {
  return (
    <main className="flex h-full bg-base">
      {/* Sidebar */}
      <div className="hidden lg:block w-64 shrink-0 border-r border-border bg-sidebar p-5 space-y-4">
        <div className="skeleton h-8 w-32" />
        <div className="space-y-2 mt-6">
          <div className="skeleton h-4 w-20" />
          <div className="skeleton h-8 w-full" />
          <div className="skeleton h-8 w-full" />
          <div className="skeleton h-8 w-full" />
          <div className="skeleton h-8 w-full" />
        </div>
      </div>

      {/* Main content area */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Top bar */}
        <div className="h-[52px] border-b border-border bg-topbar px-5 flex items-center gap-3 shrink-0">
          <div className="skeleton h-6 w-36" />
          <div className="skeleton h-6 w-20" />
        </div>

        {/* Content */}
        <div className="flex-1 bg-base p-6 overflow-hidden">
          <div className="mx-auto max-w-2xl space-y-5">
            <div className="skeleton h-7 w-48" />
            <div className="rounded-2xl border border-border bg-surface/50 p-6 space-y-4">
              <div className="skeleton h-5 w-32" />
              <div className="skeleton h-10 w-full" />
              <div className="skeleton h-5 w-40" />
              <div className="skeleton h-10 w-full" />
              <div className="skeleton h-10 w-28 mt-2" />
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
