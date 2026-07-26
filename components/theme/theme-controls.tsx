"use client";

import { useEffect, useState } from "react";
import { Monitor, Moon, Sun } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/cn";

export type ThemePreference = "light" | "dark" | "system";

const STORAGE_KEY = "stormhub-theme";
const THEME_EVENT = "stormhub:theme-change";
const themeOptions = [
  { value: "light" as const, label: "Light", description: "Always use the light palette.", icon: Sun },
  { value: "dark" as const, label: "Dark", description: "Always use the dark palette.", icon: Moon },
  { value: "system" as const, label: "System", description: "Match this device automatically.", icon: Monitor },
];

function isThemePreference(value: string | null): value is ThemePreference {
  return value === "light" || value === "dark" || value === "system";
}

function applyTheme(preference: ThemePreference) {
  const systemDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
  const useDark = preference === "dark" || (preference === "system" && systemDark);
  document.documentElement.classList.toggle("dark", useDark);
  document.documentElement.dataset.theme = preference;
  document.documentElement.style.colorScheme = useDark ? "dark" : "light";
}

function useThemePreference() {
  const [preference, setPreferenceState] = useState<ThemePreference>("system");

  useEffect(() => {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    const initial = isThemePreference(stored) ? stored : "system";
    setPreferenceState(initial);
    applyTheme(initial);

    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const onSystemChange = () => {
      const current = window.localStorage.getItem(STORAGE_KEY);
      if (!isThemePreference(current) || current === "system") applyTheme("system");
    };
    const onThemeChange = (event: Event) => {
      const next = (event as CustomEvent<ThemePreference>).detail;
      if (!isThemePreference(next)) return;
      setPreferenceState(next);
      applyTheme(next);
    };
    media.addEventListener("change", onSystemChange);
    window.addEventListener(THEME_EVENT, onThemeChange);
    return () => {
      media.removeEventListener("change", onSystemChange);
      window.removeEventListener(THEME_EVENT, onThemeChange);
    };
  }, []);

  function setPreference(next: ThemePreference) {
    window.localStorage.setItem(STORAGE_KEY, next);
    setPreferenceState(next);
    applyTheme(next);
    window.dispatchEvent(new CustomEvent(THEME_EVENT, { detail: next }));
  }

  return { preference, setPreference };
}

export function ThemeToggle({ showLabel = false }: { showLabel?: boolean }) {
  const { preference, setPreference } = useThemePreference();
  const option = themeOptions.find((item) => item.value === preference) ?? themeOptions[2];
  const Icon = option.icon;
  const next = preference === "light" ? "dark" : preference === "dark" ? "system" : "light";

  return (
    <Button
      type="button"
      variant="ghost"
      size={showLabel ? "sm" : "icon"}
      onClick={() => setPreference(next)}
      aria-label={`Theme: ${option.label}. Switch to ${next}.`}
      title={`Theme: ${option.label}`}
      className={showLabel ? "justify-start" : undefined}
    >
      <Icon className="h-4 w-4" />
      {showLabel && `Theme: ${option.label}`}
    </Button>
  );
}

export function ThemeSettings() {
  const { preference, setPreference } = useThemePreference();

  return (
    <div className="grid gap-3 sm:grid-cols-3" role="radiogroup" aria-label="Color theme">
      {themeOptions.map(({ value, label, description, icon: Icon }) => {
        const selected = preference === value;
        return (
          <button
            key={value}
            type="button"
            role="radio"
            aria-checked={selected}
            onClick={() => setPreference(value)}
            className={cn(
              "rounded-xl border p-4 text-left transition-[border-color,background-color,transform] hover:-translate-y-0.5",
              selected
                ? "border-storm-electric bg-storm-electric/10 ring-2 ring-storm-electric/15"
                : "bg-card hover:border-storm-electric/35"
            )}
          >
            <Icon className={cn("h-5 w-5", selected ? "text-storm-electric" : "text-muted-foreground")} />
            <span className="mt-3 block text-sm font-semibold">{label}</span>
            <span className="mt-1 block text-xs text-muted-foreground">{description}</span>
          </button>
        );
      })}
    </div>
  );
}
