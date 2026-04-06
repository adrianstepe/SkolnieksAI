"use client";

import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";

export type Theme = "light" | "dark" | "system";
export type FontSize = "sm" | "md" | "lg";
export type ChatWidth = "compact" | "normal" | "wide";
export type AiModel = "deepseek" | "claude";

export interface Settings {
  theme: Theme;
  fontSize: FontSize;
  chatWidth: ChatWidth;
  aiModel: AiModel;
  defaultSubject: string;
  defaultGrade: number;
  showSources: boolean;
  sendOnEnter: boolean;
}

const DEFAULTS: Settings = {
  theme: "system",
  fontSize: "md",
  chatWidth: "normal",
  aiModel: "deepseek",
  defaultSubject: "general",
  defaultGrade: 9,
  showSources: true,
  sendOnEnter: true,
};

const STORAGE_KEY = "skolnieksai_settings";

interface SettingsContextValue {
  settings: Settings;
  update: <K extends keyof Settings>(key: K, value: Settings[K]) => void;
}

const SettingsContext = createContext<SettingsContextValue | null>(null);

function loadFromStorage(): Settings {
  if (typeof window === "undefined") return DEFAULTS;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw
      ? { ...DEFAULTS, ...(JSON.parse(raw) as Partial<Settings>) }
      : DEFAULTS;
  } catch {
    return DEFAULTS;
  }
}

export function SettingsProvider({ children }: { children: ReactNode }) {
  const [settings, setSettings] = useState<Settings>(DEFAULTS);
  const [mounted, setMounted] = useState(false);

  // Hydrate from localStorage after first render
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setSettings(loadFromStorage());
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setMounted(true);
  }, []);

  // Apply theme class + font-size data attr to <html> on every change
  useEffect(() => {
    if (!mounted) return;
    const root = document.documentElement;

    const prefersDark = window.matchMedia(
      "(prefers-color-scheme: dark)",
    ).matches;
    const isDark =
      settings.theme === "dark" ||
      (settings.theme === "system" && prefersDark);
    root.classList.toggle("dark", isDark);
    root.setAttribute("data-font", settings.fontSize);

    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
    } catch {
      // ignore quota errors
    }
  }, [settings, mounted]);

  const update = <K extends keyof Settings>(key: K, value: Settings[K]) => {
    setSettings((prev) => ({ ...prev, [key]: value }));
  };

  return (
    <SettingsContext.Provider value={{ settings, update }}>
      {children}
    </SettingsContext.Provider>
  );
}

export function useSettings(): SettingsContextValue {
  const ctx = useContext(SettingsContext);
  if (!ctx) throw new Error("useSettings must be used inside SettingsProvider");
  return ctx;
}
