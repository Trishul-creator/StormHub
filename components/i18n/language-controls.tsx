"use client";

import { Check, Globe2 } from "lucide-react";
import { cn } from "@/lib/cn";
import { localeOptions, type Locale } from "@/lib/i18n/config";
import { useLanguage } from "@/components/i18n/language-provider";

export function LanguageSwitcher({ showLabel = false }: { showLabel?: boolean }) {
  const { locale, setLocale, t } = useLanguage();
  const currentOption = localeOptions.find((option) => option.value === locale) ?? localeOptions[0];

  return (
    <label
      className={cn(
        "inline-flex items-center gap-2 rounded-lg border border-transparent text-sm text-storm-navy transition-colors hover:bg-storm-light/50",
        showLabel ? "w-full px-3 py-2" : "px-2 py-1.5"
      )}
      title={t("language.current", {
        language: currentOption.nativeLabel,
      })}
    >
      <Globe2 className="h-4 w-4 shrink-0" aria-hidden="true" />
      {showLabel && <span className="font-medium">{t("common.language")}</span>}
      <span className="sr-only">{t("language.change")}</span>
      <select
        value={locale}
        onChange={(event) => setLocale(event.target.value as Locale)}
        aria-label={t("language.change")}
        className={cn(
          "min-w-0 cursor-pointer bg-transparent text-sm outline-none",
          showLabel ? "ms-auto" : "w-[5.4rem]"
        )}
      >
        {localeOptions.map((option) => (
          <option key={option.value} value={option.value} className="bg-background text-foreground">
            {option.nativeLabel}
          </option>
        ))}
      </select>
    </label>
  );
}

export function LanguageSettings() {
  const { locale, setLocale, t } = useLanguage();

  return (
    <div>
      <div className="grid gap-3 sm:grid-cols-2" role="radiogroup" aria-label={t("language.interface")}>
        {localeOptions.map((option) => {
          const selected = locale === option.value;
          const labelKey = `common.${option.value === "zh" ? "chinese" : option.value === "en" ? "english" : option.value === "es" ? "spanish" : option.value === "fr" ? "french" : option.value === "ar" ? "arabic" : "hindi"}` as const;
          const label = t(labelKey);
          return (
            <button
              key={option.value}
              type="button"
              role="radio"
              aria-checked={selected}
              onClick={() => setLocale(option.value)}
              className={cn(
                "flex items-center gap-3 rounded-xl border p-4 text-left transition-[border-color,background-color,transform] hover:-translate-y-0.5",
                selected
                  ? "border-storm-electric bg-storm-electric/10 ring-2 ring-storm-electric/15"
                  : "bg-card hover:border-storm-electric/35"
              )}
            >
              <span className="flex h-10 w-10 items-center justify-center rounded-full bg-storm-light text-sm font-bold text-storm-blue">
                {option.shortLabel}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block font-semibold">{label}</span>
                <span className="block text-xs text-muted-foreground">{option.nativeLabel}</span>
              </span>
              {selected && <Check className="h-5 w-5 text-storm-electric" aria-hidden="true" />}
            </button>
          );
        })}
      </div>
      <p className="mt-4 text-sm text-muted-foreground">{t("language.contentNote")}</p>
    </div>
  );
}
