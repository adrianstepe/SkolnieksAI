/**
 * components/admin/StatCard.tsx
 *
 * Reusable metric card for the admin dashboard.
 * Accepts any lucide-react icon, a value, a label, and optional colour tokens.
 */

import type { LucideIcon } from "lucide-react";

interface StatCardProps {
  label: string;
  value: string | number;
  icon: LucideIcon;
  /** Tailwind text-color class for the icon, e.g. "text-primary" */
  iconColor?: string;
  /** Tailwind bg-color class for the icon container, e.g. "bg-primary/10" */
  iconBg?: string;
  /** Tailwind border-color class for the icon container, e.g. "border-primary/20" */
  iconBorder?: string;
  /** Optional sub-label or unit shown in smaller text after the value */
  unit?: string;
}

export default function StatCard({
  label,
  value,
  icon: Icon,
  iconColor = "text-primary",
  iconBg = "bg-primary/10",
  iconBorder = "border-primary/20",
  unit,
}: StatCardProps) {
  return (
    <div className="rounded-2xl border border-border bg-surface/60 p-5 shadow-sm">
      <div
        className={`mb-3 inline-flex h-9 w-9 items-center justify-center rounded-xl border ${iconBg} ${iconBorder}`}
      >
        <Icon className={`h-4 w-4 ${iconColor}`} />
      </div>
      <p className="text-2xl font-bold text-text-primary">
        {value}
        {unit && (
          <span className="ml-1 text-sm font-normal text-text-muted">
            {unit}
          </span>
        )}
      </p>
      <p className="mt-0.5 text-xs text-text-muted">{label}</p>
    </div>
  );
}
