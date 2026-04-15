import {
  LayoutDashboard,
  Users,
  FlaskConical,
  CreditCard,
  FileText,
  Settings,
  Activity,
  Tag,
} from "lucide-react";
import AdminLogoutButton from "./AdminLogoutButton";

const NAV_ITEMS = [
  {
    label: "Overview",
    href: "/admin-dashboard",
    icon: LayoutDashboard,
  },
  {
    label: "Users",
    href: "/admin-dashboard/users",
    icon: Users,
  },
  {
    label: "RAG Tester",
    href: "/admin-dashboard/rag",
    icon: FlaskConical,
  },
  {
    label: "Payments",
    href: "/admin-dashboard/payments",
    icon: CreditCard,
  },
  {
    label: "Affiliates",
    href: "/admin-dashboard/affiliates",
    icon: Tag,
  },
  {
    label: "Activity Logs",
    href: "/admin-dashboard/logs",
    icon: Activity,
  },
  {
    label: "Settings",
    href: "/admin-dashboard/settings",
    icon: Settings,
  },
];

export default function AdminSidebar() {
  return (
    <aside className="flex h-screen w-60 flex-shrink-0 flex-col border-r border-border bg-sidebar sticky top-0">
      {/* Branding */}
      <div className="flex items-center gap-3 px-5 py-5 border-b border-border">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-accent/15 border border-accent/20">
          <FileText className="h-4 w-4 text-accent" />
        </div>
        <div>
          <p className="text-sm font-semibold text-text-primary leading-none">
            Dev Admin
          </p>
          <p className="mt-0.5 text-[10px] text-text-muted">SkolnieksAI</p>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto thin-scrollbar px-3 py-4 space-y-0.5">
        {NAV_ITEMS.map(({ label, href, icon: Icon }) => (
          <a
            key={href}
            href={href}
            className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm text-text-secondary transition hover:bg-surface-hover hover:text-text-primary group"
          >
            <Icon className="h-4 w-4 flex-shrink-0 text-text-muted group-hover:text-accent transition" />
            {label}
          </a>
        ))}
      </nav>

      {/* Footer */}
      <div className="border-t border-border p-3">
        <AdminLogoutButton />
      </div>
    </aside>
  );
}
