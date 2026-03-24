"use client";

import {
  useSettings,
  type Theme,
  type FontSize,
  type ChatWidth,
  type AiModel,
} from "@/lib/context/settings-context";
import { SUBJECTS, GRADES } from "@/components/chat/SubjectGradeSelector";
import { useAuth } from "@/lib/context/auth-context";
import { useState } from "react";

interface SettingsPanelProps {
  onClose: () => void;
}

// ---------------------------------------------------------------------------
// Primitives
// ---------------------------------------------------------------------------

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <h3 className="mb-3 text-[11px] font-semibold uppercase tracking-widest text-text-muted">
      {children}
    </h3>
  );
}

function Row({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-center justify-between gap-4 py-2.5">
      <span className="text-sm text-text-secondary">{label}</span>
      {children}
    </div>
  );
}

function Toggle({
  checked,
  onChange,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <button
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors focus:outline-none ${
        checked ? "bg-primary" : "bg-surface-hover"
      }`}
    >
      <span
        className={`pointer-events-none inline-block h-5 w-5 rounded-full bg-white shadow-sm transition-transform ${
          checked ? "translate-x-5" : "translate-x-0"
        }`}
      />
    </button>
  );
}

function SegmentedControl<T extends string>({
  options,
  value,
  onChange,
}: {
  options: { value: T; label: string }[];
  value: T;
  onChange: (v: T) => void;
}) {
  return (
    <div className="flex overflow-hidden rounded-lg border border-border">
      {options.map((opt) => (
        <button
          key={opt.value}
          onClick={() => onChange(opt.value)}
          className={`flex-1 px-3 py-1.5 text-sm font-medium transition-colors ${
            value === opt.value
              ? "bg-primary text-white"
              : "bg-surface text-text-secondary hover:bg-surface-hover hover:text-text-primary"
          }`}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Panel
// ---------------------------------------------------------------------------

export function SettingsPanel({ onClose }: SettingsPanelProps) {
  const { settings, update } = useSettings();
  const { profile, getIdToken } = useAuth();
  const [loadingPortal, setLoadingPortal] = useState(false);

  const isPremium =
    profile?.tier === "premium" ||
    profile?.tier === "exam_prep" ||
    profile?.tier === "school_pro";

  const handleManageSubscription = async () => {
    setLoadingPortal(true);
    try {
      const token = await getIdToken();
      if (!token) return;
      const res = await fetch("/api/stripe/portal", {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (data.url) {
        window.location.href = data.url;
      }
    } catch (err) {
      console.error(err);
      setLoadingPortal(false);
    }
  };

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-40 bg-black/50"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Drawer */}
      <aside className="fixed inset-y-0 right-0 z-50 flex w-80 flex-col bg-base shadow-2xl border-l border-border">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-border px-5 py-4">
          <h2 className="text-base font-semibold text-text-primary">
            Iestatījumi
          </h2>
          <button
            onClick={onClose}
            className="rounded-lg p-1.5 text-text-muted transition-colors hover:bg-surface hover:text-text-secondary"
            aria-label="Aizvērt"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 20 20"
              fill="currentColor"
              className="h-5 w-5"
            >
              <path d="M6.28 5.22a.75.75 0 0 0-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 1 0 1.06 1.06L10 11.06l3.72 3.72a.75.75 0 1 0 1.06-1.06L11.06 10l3.72-3.72a.75.75 0 0 0-1.06-1.06L10 8.94 6.28 5.22Z" />
            </svg>
          </button>
        </div>

        {/* Scrollable body */}
        <div className="flex-1 space-y-6 overflow-y-auto px-5 py-5 thin-scrollbar">
          {/* ── Izskats ── */}
          <section>
            <SectionTitle>Izskats</SectionTitle>
            <div className="divide-y divide-border">
              <Row label="Krāsu tema">
                <SegmentedControl<Theme>
                  value={settings.theme}
                  onChange={(v) => update("theme", v)}
                  options={[
                    { value: "light", label: "Gaišs" },
                    { value: "dark", label: "Tumšs" },
                    { value: "system", label: "Auto" },
                  ]}
                />
              </Row>
              <Row label="Teksta izmērs">
                <SegmentedControl<FontSize>
                  value={settings.fontSize}
                  onChange={(v) => update("fontSize", v)}
                  options={[
                    { value: "sm", label: "Mazs" },
                    { value: "md", label: "Vidējs" },
                    { value: "lg", label: "Liels" },
                  ]}
                />
              </Row>
              <Row label="Čata platums">
                <SegmentedControl<ChatWidth>
                  value={settings.chatWidth}
                  onChange={(v) => update("chatWidth", v)}
                  options={[
                    { value: "compact", label: "Šaurs" },
                    { value: "normal", label: "Normāls" },
                    { value: "wide", label: "Plašs" },
                  ]}
                />
              </Row>
            </div>
          </section>

          {/* ── AI modelis ── */}
          <section>
            <SectionTitle>AI modelis</SectionTitle>
            <div className="divide-y divide-border">
              <Row label="Modelis">
                <SegmentedControl<AiModel>
                  value={settings.aiModel}
                  onChange={(v) => update("aiModel", v)}
                  options={[
                    { value: "deepseek", label: "Standarta palīgs" },
                    { value: "claude", label: "Eksāmenu eksperts" },
                  ]}
                />
              </Row>
            </div>
            <p className="mt-2 text-xs text-text-muted">
              {settings.aiModel === "claude"
                ? "Eksāmenu eksperts — ātrāks, detalizētāks (maksas)"
                : "Standarta palīgs — ikdienas jautājumiem (bezmaksas līmenis)"}
            </p>
          </section>

          {/* ── Noklusējums ── */}
          <section>
            <SectionTitle>Noklusējuma iestatījumi</SectionTitle>
            <div className="space-y-4">
              <div>
                <label className="mb-1.5 block text-sm text-text-secondary">
                  Priekšmets
                </label>
                <select
                  value={settings.defaultSubject}
                  onChange={(e) => update("defaultSubject", e.target.value)}
                  className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm text-text-primary focus:border-primary/40 focus:outline-none focus:ring-1 focus:ring-primary/20"
                >
                  {SUBJECTS.map((s) => (
                    <option key={s.value} value={s.value}>
                      {s.label}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="mb-1.5 block text-sm text-text-secondary">
                  Klase
                </label>
                <div className="flex flex-wrap gap-1">
                  {GRADES.map((g) => (
                    <button
                      key={g}
                      onClick={() => update("defaultGrade", g)}
                      className={`rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                        settings.defaultGrade === g
                          ? "bg-primary text-white"
                          : "border border-border bg-surface text-text-secondary hover:bg-surface-hover hover:text-text-primary"
                      }`}
                    >
                      {g}.
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </section>

          {/* ── Vēlmes ── */}
          <section>
            <SectionTitle>Vēlmes</SectionTitle>
            <div className="divide-y divide-border">
              <Row label="Rādīt avotus">
                <Toggle
                  checked={settings.showSources}
                  onChange={(v) => update("showSources", v)}
                />
              </Row>
              <Row label="Sūtīt ar Enter">
                <Toggle
                  checked={settings.sendOnEnter}
                  onChange={(v) => update("sendOnEnter", v)}
                />
              </Row>
            </div>
          </section>

          {/* ── Abonements ── */}
          {isPremium && (
            <section>
              <SectionTitle>Abonements</SectionTitle>
              <div className="py-2.5">
                <button
                  onClick={handleManageSubscription}
                  disabled={loadingPortal}
                  className="w-full rounded-lg bg-surface border border-border px-4 py-2.5 text-sm font-medium text-text-primary transition-colors hover:bg-surface-hover disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {loadingPortal ? (
                    <span className="h-4 w-4 animate-spin rounded-full border-2 border-primary/30 border-t-primary" />
                  ) : (
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4 text-primary">
                      <path fillRule="evenodd" d="M2.5 4A1.5 1.5 0 0 0 1 5.5V6h18v-.5A1.5 1.5 0 0 0 17.5 4h-15ZM19 8.5H1v6A1.5 1.5 0 0 0 2.5 16h15a1.5 1.5 0 0 0 1.5-1.5v-6ZM3 13.25a.75.75 0 0 1 .75-.75h1.5a.75.75 0 0 1 0 1.5h-1.5a.75.75 0 0 1-.75-.75Zm4.75-.75a.75.75 0 0 0 0 1.5h3.5a.75.75 0 0 0 0-1.5h-3.5Z" clipRule="evenodd" />
                    </svg>
                  )}
                  {loadingPortal ? "Notiek pāradresēšana..." : "Pārvaldīt abonementu"}
                </button>
              </div>
            </section>
          )}
        </div>

        {/* Footer */}
        <div className="border-t border-border px-5 py-3">
          <p className="text-center text-xs text-text-muted">
            SkolnieksAI · Skola2030
          </p>
        </div>
      </aside>
    </>
  );
}
