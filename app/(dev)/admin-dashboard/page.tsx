/**
 * app/(dev)/admin-dashboard/page.tsx
 *
 * Overview page — fetches real metrics from Firestore via the analytics API
 * and renders them using the reusable StatCard component.
 */

import { Users, MessageSquare, MessagesSquare, Activity } from "lucide-react";
import { ArrowRight } from "lucide-react";
import StatCard from "@/components/admin/StatCard";

interface AnalyticsData {
  totalUsers: number;
  totalConversations: number;
  totalMessages: number;
  activeToday: number;
}

async function getAnalytics(): Promise<AnalyticsData> {
  try {
    // Use an absolute URL — required for server-side fetch in Next.js app router
    const baseUrl =
      process.env.NEXT_PUBLIC_APP_URL ??
      (process.env.VERCEL_URL
        ? `https://${process.env.VERCEL_URL}`
        : "http://localhost:3000");

    const res = await fetch(`${baseUrl}/api/admin/analytics`, {
      cache: "no-store",
    });

    if (!res.ok) return { totalUsers: 0, totalConversations: 0, totalMessages: 0, activeToday: 0 };
    return (await res.json()) as AnalyticsData;
  } catch {
    return { totalUsers: 0, totalConversations: 0, totalMessages: 0, activeToday: 0 };
  }
}

const QUICK_LINKS = [
  { label: "RAG Test Harness", href: "/admin-dashboard/rag" },
  { label: "Payment Activity", href: "/admin-dashboard/payments" },
  { label: "Activity Logs", href: "/admin-dashboard/logs" },
  { label: "Settings", href: "/admin-dashboard/settings" },
];

export default async function AdminDashboardPage() {
  const stats = await getAnalytics();

  const STAT_CARDS = [
    {
      label: "Total Users",
      value: stats.totalUsers.toLocaleString(),
      icon: Users,
      iconColor: "text-primary",
      iconBg: "bg-primary/10",
      iconBorder: "border-primary/20",
    },
    {
      label: "Total Conversations",
      value: stats.totalConversations.toLocaleString(),
      icon: MessagesSquare,
      iconColor: "text-accent",
      iconBg: "bg-accent/10",
      iconBorder: "border-accent/20",
    },
    {
      label: "Total Messages",
      value: stats.totalMessages > 0 ? stats.totalMessages.toLocaleString() : "N/A",
      icon: MessageSquare,
      iconColor: "text-success",
      iconBg: "bg-success/10",
      iconBorder: "border-success/20",
    },
    {
      label: "Active Today",
      value: stats.activeToday.toLocaleString(),
      icon: Activity,
      iconColor: "text-warning",
      iconBg: "bg-warning/10",
      iconBorder: "border-warning/20",
    },
  ] as const;

  return (
    <div className="max-w-5xl space-y-8 animate-fade-up">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-text-primary">Overview</h1>
        <p className="mt-1 text-sm text-text-muted">
          SkolnieksAI · Dev Admin Panel
        </p>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {STAT_CARDS.map((card) => (
          <StatCard key={card.label} {...card} />
        ))}
      </div>

      {/* Quick links */}
      <div className="rounded-2xl border border-border bg-surface/40 p-6">
        <h2 className="mb-4 text-sm font-semibold uppercase tracking-wider text-text-muted">
          Quick Links
        </h2>
        <div className="grid gap-2 sm:grid-cols-2">
          {QUICK_LINKS.map(({ label, href }) => (
            <a
              key={href}
              href={href}
              className="flex items-center justify-between rounded-xl border border-border bg-surface/50 px-4 py-3 text-sm text-text-secondary transition hover:border-border hover:bg-surface-hover hover:text-text-primary group"
            >
              {label}
              <ArrowRight className="h-4 w-4 text-text-muted group-hover:text-accent transition" />
            </a>
          ))}
        </div>
      </div>

      {/* Dev info banner */}
      <div className="rounded-2xl border border-accent/20 bg-accent/5 px-5 py-4 text-sm text-text-secondary">
        <span className="font-semibold text-accent">Dev Mode</span> — this
        dashboard is only accessible with admin credentials and is invisible to
        regular users. Add new tools by creating pages under{" "}
        <code className="font-mono text-xs text-text-primary">
          app/(dev)/admin-dashboard/
        </code>
        .
      </div>
    </div>
  );
}
