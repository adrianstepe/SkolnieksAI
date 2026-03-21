"use client";

import {
  useSettings,
  type Theme,
  type FontSize,
  type ChatWidth,
} from "@/lib/context/settings-context";
import { SUBJECTS, GRADES } from "@/components/chat/SubjectGradeSelector";

interface SettingsPanelProps {
  onClose: () => void;
}

// ---------------------------------------------------------------------------
// Primitives
// ---------------------------------------------------------------------------

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <h3 className="mb-3 text-xs font-semibold uppercase tracking-wider text-gray-400 dark:text-slate-500">
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
      <span className="text-sm text-gray-700 dark:text-slate-300">{label}</span>
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
        checked ? "bg-brand-600" : "bg-gray-200 dark:bg-slate-600"
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
    <div className="flex overflow-hidden rounded-lg border border-gray-200 dark:border-slate-600">
      {options.map((opt) => (
        <button
          key={opt.value}
          onClick={() => onChange(opt.value)}
          className={`flex-1 px-3 py-1.5 text-sm font-medium transition-colors ${
            value === opt.value
              ? "bg-brand-600 text-white"
              : "bg-white text-gray-600 hover:bg-gray-50 dark:bg-slate-700 dark:text-slate-300 dark:hover:bg-slate-600"
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

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-40 bg-black/30"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Drawer */}
      <aside className="fixed inset-y-0 right-0 z-50 flex w-80 flex-col bg-white shadow-xl dark:bg-slate-800">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-gray-200 px-5 py-4 dark:border-slate-700">
          <h2 className="text-base font-semibold text-gray-900 dark:text-slate-100">
            Iestatījumi
          </h2>
          <button
            onClick={onClose}
            className="rounded-lg p-1.5 text-gray-500 transition-colors hover:bg-gray-100 dark:text-slate-400 dark:hover:bg-slate-700"
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
        <div className="flex-1 space-y-6 overflow-y-auto px-5 py-5">

          {/* ── Izskats ── */}
          <section>
            <SectionTitle>Izskats</SectionTitle>
            <div className="divide-y divide-gray-100 dark:divide-slate-700">
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

          {/* ── Noklusējums ── */}
          <section>
            <SectionTitle>Noklusējuma iestatījumi</SectionTitle>
            <div className="space-y-4">
              <div>
                <label className="mb-1.5 block text-sm text-gray-700 dark:text-slate-300">
                  Priekšmets
                </label>
                <select
                  value={settings.defaultSubject}
                  onChange={(e) => update("defaultSubject", e.target.value)}
                  className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-700 focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-200"
                >
                  {SUBJECTS.map((s) => (
                    <option key={s.value} value={s.value}>
                      {s.label}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="mb-1.5 block text-sm text-gray-700 dark:text-slate-300">
                  Klase
                </label>
                <div className="flex flex-wrap gap-1">
                  {GRADES.map((g) => (
                    <button
                      key={g}
                      onClick={() => update("defaultGrade", g)}
                      className={`rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                        settings.defaultGrade === g
                          ? "bg-brand-600 text-white"
                          : "border border-gray-200 bg-white text-gray-600 hover:bg-gray-50 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-300 dark:hover:bg-slate-600"
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
            <div className="divide-y divide-gray-100 dark:divide-slate-700">
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
        </div>

        {/* Footer */}
        <div className="border-t border-gray-200 px-5 py-3 dark:border-slate-700">
          <p className="text-center text-xs text-gray-400 dark:text-slate-500">
            SkolnieksAI · Skola2030
          </p>
        </div>
      </aside>
    </>
  );
}
