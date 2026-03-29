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
import { useState, useEffect } from "react";
import { UpgradeModal } from "@/components/chat/UpgradeModal";

interface SettingsPanelProps {
  onClose: () => void;
}

// ---------------------------------------------------------------------------
// Primitives
// ---------------------------------------------------------------------------

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <h3 className="mb-4 text-[11px] font-semibold uppercase tracking-widest text-[#6B7280] dark:text-[#8B95A8]">
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
    <div className="flex items-center justify-between gap-4">
      <span className="text-sm font-medium text-[#374151] dark:text-[#8B95A8]">{label}</span>
      {children}
    </div>
  );
}

function Toggle({
  checked,
  onChange,
  ariaLabel,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  ariaLabel?: string;
}) {
  return (
    <button
      role="switch"
      aria-checked={checked}
      aria-label={ariaLabel}
      onClick={() => onChange(!checked)}
      className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1D4ED8] dark:focus-visible:ring-[#3D7CE5] ${
        checked ? "bg-[#1D4ED8] dark:bg-[#3D7CE5]" : "bg-[#D1D5DB] dark:bg-[#1A2033]"
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
  ariaLabel,
}: {
  options: { value: T; label: string; subLabel?: string }[];
  value: T;
  onChange: (v: T) => void;
  ariaLabel?: string;
}) {
  return (
    <div 
      className="flex rounded-xl bg-[#F3F4F6] dark:bg-[#1A2033]/50 p-1"
      role="radiogroup" 
      aria-label={ariaLabel}
    >
      {options.map((opt) => {
        const isSelected = value === opt.value;
        return (
          <button
            key={opt.value}
            role="radio"
            aria-checked={isSelected}
            onClick={() => onChange(opt.value)}
            className={`flex flex-1 flex-col items-center justify-center rounded-lg px-3 py-1.5 text-sm font-medium transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1D4ED8] dark:focus-visible:ring-[#3D7CE5] ${
              isSelected
                ? "bg-[#1D4ED8] dark:bg-[#3D7CE5] text-white shadow-sm"
                : "text-[#374151] dark:text-[#8B95A8] hover:text-[#111827] dark:hover:text-[#E8ECF4]"
            }`}
          >
            <span className="text-center leading-tight whitespace-pre-line">
              {opt.label}
              {opt.subLabel && (
                <span className="block text-[10px] font-normal opacity-80 mt-0.5 whitespace-pre-line">
                  {opt.subLabel}
                </span>
              )}
            </span>
          </button>
        );
      })}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Subcomponents
// ---------------------------------------------------------------------------

function AppearanceSection() {
  const { settings, update } = useSettings();

  return (
    <section>
      <SectionTitle>Izskats</SectionTitle>
      <div className="flex flex-col gap-4">
        <Row label="Krāsu tēma">
          <SegmentedControl<Theme>
            value={settings.theme}
            onChange={(v) => update("theme", v)}
            ariaLabel="Krāsu tēma"
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
            ariaLabel="Teksta izmērs"
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
            ariaLabel="Čata platums"
            options={[
              { value: "compact", label: "Šaurs" },
              { value: "normal", label: "Normāls" },
              { value: "wide", label: "Plašs" },
            ]}
          />
        </Row>
      </div>
    </section>
  );
}

function AiModelSection() {
  const { settings, update } = useSettings();
  const { profile } = useAuth();
  const [showUpgradeModal, setShowUpgradeModal] = useState(false);

  const canUseClaude =
    profile?.tier === "exam_prep" || profile?.tier === "school_pro";

  useEffect(() => {
    if (!canUseClaude && settings.aiModel === "claude") {
      update("aiModel", "deepseek");
    }
  }, [canUseClaude, settings.aiModel]);

  const activeModel = canUseClaude ? settings.aiModel : "deepseek";

  const btnBase =
    "flex flex-1 flex-col items-center justify-center rounded-lg px-3 py-1.5 text-sm font-medium transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1D4ED8] dark:focus-visible:ring-[#3D7CE5]";
  const btnActive = "bg-[#1D4ED8] dark:bg-[#3D7CE5] text-white shadow-sm";
  const btnInactive =
    "text-[#374151] dark:text-[#8B95A8] hover:text-[#111827] dark:hover:text-[#E8ECF4]";

  return (
    <section>
      <SectionTitle>AI modelis</SectionTitle>
      <div className="flex flex-col gap-4">
        <Row label="Modelis">
          <div
            className="flex rounded-xl bg-[#F3F4F6] dark:bg-[#1A2033]/50 p-1"
            role="radiogroup"
            aria-label="AI Modelis"
          >
            {/* DeepSeek — always selectable */}
            <button
              role="radio"
              aria-checked={activeModel === "deepseek"}
              onClick={() => update("aiModel", "deepseek")}
              className={`${btnBase} ${activeModel === "deepseek" ? btnActive : btnInactive}`}
            >
              <span className="text-center leading-tight whitespace-pre-line">
                Standarta{"\n"}palīgs
              </span>
            </button>

            {/* Claude — gated by tier */}
            <button
              role="radio"
              aria-checked={activeModel === "claude"}
              onClick={() => {
                if (canUseClaude) {
                  update("aiModel", "claude");
                } else {
                  setShowUpgradeModal(true);
                }
              }}
              className={`${btnBase} ${activeModel === "claude" ? btnActive : btnInactive} ${!canUseClaude ? "opacity-60" : ""}`}
            >
              <span className="text-center leading-tight whitespace-pre-line">
                Eksāmenu{"\n"}eksperts
                {!canUseClaude && (
                  <span className="block text-[10px] font-normal opacity-80 mt-0.5">
                    🔒 Premium
                  </span>
                )}
              </span>
            </button>
          </div>
        </Row>
        <p className="mt-1 text-xs leading-relaxed text-[#6B7280] dark:text-[#8B95A8]">
          {activeModel === "claude"
            ? "Eksāmenu eksperts — ātrāks, detalizētāks (maksas)"
            : "Standarta palīgs — ikdienas jautājumiem (bezmaksas līmenis)"}
        </p>
      </div>
      {showUpgradeModal && (
        <UpgradeModal onClose={() => setShowUpgradeModal(false)} />
      )}
    </section>
  );
}

function DefaultsSection() {
  const { settings, update } = useSettings();
  const { getIdToken, refreshProfile } = useAuth();

  const handleUpdatePreference = async (key: string, value: string | number) => {
    // 1. Update securely via API
    try {
      const token = await getIdToken();
      if (token) {
        // Map local setting keys to backend expectation
        const payload: Record<string, any> = {};
        if (key === "defaultGrade") payload.grade = value;
        if (key === "defaultSubject") payload.subject = value;

        await fetch("/api/auth/update-profile", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}` 
          },
          body: JSON.stringify(payload),
        });
        await refreshProfile();
      }
    } catch (err) {
      console.error("Failed to sync preference with server", err);
    }
  };

  const handleSubjectChange = (val: string) => {
    update("defaultSubject", val);
    handleUpdatePreference("defaultSubject", val);
  };

  const handleGradeChange = (g: number) => {
    update("defaultGrade", g);
    handleUpdatePreference("defaultGrade", g);
  };

  return (
    <section>
      <SectionTitle>Noklusējuma iestatījumi</SectionTitle>
      <div className="flex flex-col gap-4">
        <div>
          <label className="mb-2 block text-sm font-medium text-[#374151] dark:text-[#8B95A8]">
            Priekšmets
          </label>
          <div className="relative">
            <select
              value={settings.defaultSubject}
              onChange={(e) => handleSubjectChange(e.target.value)}
              aria-label="Priekšmets Noklusējums"
              className="w-full appearance-none rounded-xl border border-[#D1D5DB] dark:border-white/7 bg-white dark:bg-[#0D1117] px-4 py-2.5 text-sm font-medium text-[#111827] dark:text-[#E8ECF4] focus-visible:border-[#1D4ED8]/40 dark:focus-visible:border-[#3D7CE5]/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1D4ED8]/20 dark:focus-visible:ring-[#3D7CE5]/20"
            >
              {SUBJECTS.map((s) => (
                <option key={s.value} value={s.value}>
                  {s.label}
                </option>
              ))}
            </select>
            <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-4 text-[#6B7280] dark:text-[#8B95A8]">
               <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-5 h-5">
                 <path fillRule="evenodd" d="M5.22 8.22a.75.75 0 0 1 1.06 0L10 11.94l3.72-3.72a.75.75 0 1 1 1.06 1.06l-4.25 4.25a.75.75 0 0 1-1.06 0L5.22 9.28a.75.75 0 0 1 0-1.06Z" clipRule="evenodd" />
               </svg>
            </div>
          </div>
        </div>

        <div>
           <label className="mb-2 block text-sm font-medium text-[#374151] dark:text-[#8B95A8]">
            Klase
           </label>
           <div 
             className="flex flex-wrap gap-2" 
             role="radiogroup" 
             aria-label="Noklusējuma klase"
           >
             {GRADES.map((g) => {
               const isSelected = settings.defaultGrade === g;
               return (
                 <button
                   key={g}
                   role="radio"
                   aria-checked={isSelected}
                   onClick={() => handleGradeChange(g)}
                   className={`flex h-10 w-10 items-center justify-center rounded-xl text-sm font-medium transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1D4ED8] dark:focus-visible:ring-[#3D7CE5] ${
                     isSelected
                       ? "bg-[#1D4ED8] dark:bg-[#3D7CE5] text-white shadow-sm"
                       : "bg-white dark:bg-[#1A2033] border border-[#D1D5DB] dark:border-white/7 hover:bg-[#F3F4F6] dark:hover:bg-[#1A2033]/70 text-[#374151] dark:text-[#8B95A8] hover:text-[#111827] dark:hover:text-[#E8ECF4]"
                   }`}
                 >
                   {g}.
                 </button>
               );
             })}
           </div>
        </div>
      </div>
    </section>
  );
}

function PreferencesSection() {
  const { settings, update } = useSettings();

  return (
    <section>
      <SectionTitle>Vēlmes</SectionTitle>
      <div className="flex flex-col gap-4">
        <Row label="Rādīt avotus">
          <Toggle
            checked={settings.showSources}
            onChange={(v) => update("showSources", v)}
            ariaLabel="Rādīt avotus"
          />
        </Row>
        <Row label="Sūtīt ar Enter">
          <Toggle
            checked={settings.sendOnEnter}
            onChange={(v) => update("sendOnEnter", v)}
            ariaLabel="Sūtīt ar Enter"
          />
        </Row>
      </div>
    </section>
  );
}

function SubscriptionSection() {
  const { profile, getIdToken } = useAuth();
  const [loadingPortal, setLoadingPortal] = useState(false);

  const isPremium =
    profile?.tier === "premium" ||
    profile?.tier === "exam_prep" ||
    profile?.tier === "school_pro";

  if (!isPremium) return null;

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
    <section>
      <SectionTitle>Abonements</SectionTitle>
      <div className="py-2.5">
        <button
          onClick={handleManageSubscription}
          disabled={loadingPortal}
          className="w-full rounded-xl bg-white dark:bg-[#1A2033] border border-[#D1D5DB] dark:border-white/7 px-4 py-2.5 text-sm font-medium text-[#111827] dark:text-[#E8ECF4] transition-colors hover:bg-[#F3F4F6] dark:hover:bg-[#1A2033]/70 disabled:opacity-50 flex items-center justify-center gap-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1D4ED8] dark:focus-visible:ring-[#3D7CE5]"
        >
          {loadingPortal ? (
            <span className="h-4 w-4 animate-spin rounded-full border-2 border-[#1D4ED8]/30 dark:border-[#3D7CE5]/30 border-t-[#1D4ED8] dark:border-t-[#3D7CE5]" />
          ) : (
             <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4 text-[#1D4ED8] dark:text-[#3D7CE5]">
                <path fillRule="evenodd" d="M2.5 4A1.5 1.5 0 0 0 1 5.5V6h18v-.5A1.5 1.5 0 0 0 17.5 4h-15ZM19 8.5H1v6A1.5 1.5 0 0 0 2.5 16h15a1.5 1.5 0 0 0 1.5-1.5v-6ZM3 13.25a.75.75 0 0 1 .75-.75h1.5a.75.75 0 0 1 0 1.5h-1.5a.75.75 0 0 1-.75-.75Zm4.75-.75a.75.75 0 0 0 0 1.5h3.5a.75.75 0 0 0 0-1.5h-3.5Z" clipRule="evenodd" />
             </svg>
          )}
          {loadingPortal ? "Notiek pāradresēšana..." : "Pārvaldīt abonementu"}
        </button>
      </div>
    </section>
  );
}

// ---------------------------------------------------------------------------
// Panel
// ---------------------------------------------------------------------------

export function SettingsPanel({ onClose }: SettingsPanelProps) {
  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-40 bg-black/50 backdrop-blur-sm transition-opacity"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Drawer */}
      <aside 
        className="fixed inset-y-0 right-0 z-50 flex w-[340px] flex-col bg-white dark:bg-[#0D1117] shadow-2xl border-l border-[#D1D5DB] dark:border-white/7"
        role="dialog"
        aria-label="Iestatījumi"
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-[#D1D5DB] dark:border-white/7 px-6 py-5">
          <h2 className="text-lg font-bold text-[#111827] dark:text-[#E8ECF4]">
            Iestatījumi
          </h2>
          <button
            onClick={onClose}
            className="rounded-full p-2 text-[#6B7280] dark:text-[#8B95A8] transition-colors hover:bg-[#F3F4F6] dark:hover:bg-[#1A2033]/50 hover:text-[#111827] dark:hover:text-[#E8ECF4] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1D4ED8] dark:focus-visible:ring-[#3D7CE5]"
            aria-label="Aizvērt"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
              strokeWidth={2}
              stroke="currentColor"
              className="h-5 w-5"
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Scrollable body */}
        <div className="flex-1 space-y-8 overflow-y-auto px-6 py-6 thin-scrollbar">
          <AppearanceSection />
          <AiModelSection />
          <DefaultsSection />
          <PreferencesSection />
          <SubscriptionSection />
        </div>

        {/* Footer */}
        <div className="border-t border-[#D1D5DB] dark:border-white/7 px-6 py-4">
          <p className="text-center text-xs font-medium text-[#6B7280] dark:text-[#8B95A8]">
            SkolnieksAI
          </p>
        </div>
      </aside>
    </>
  );
}
