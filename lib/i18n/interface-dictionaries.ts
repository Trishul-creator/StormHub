import type { Locale } from "@/lib/i18n/config";

export type InterfaceDictionary = Record<string, string>;

const loaders: Partial<Record<Locale, () => Promise<InterfaceDictionary>>> = {
  es: () => import("@/lib/i18n/generated/es.json").then((module) => module.default),
  fr: () => import("@/lib/i18n/generated/fr.json").then((module) => module.default),
  zh: () => import("@/lib/i18n/generated/zh.json").then((module) => module.default),
  ar: () => import("@/lib/i18n/generated/ar.json").then((module) => module.default),
  hi: () => import("@/lib/i18n/generated/hi.json").then((module) => module.default),
  de: () => import("@/lib/i18n/generated/de.json").then((module) => module.default),
  pt: () => import("@/lib/i18n/generated/pt.json").then((module) => module.default),
  vi: () => import("@/lib/i18n/generated/vi.json").then((module) => module.default),
  ja: () => import("@/lib/i18n/generated/ja.json").then((module) => module.default),
  ko: () => import("@/lib/i18n/generated/ko.json").then((module) => module.default),
};

const cache = new Map<Locale, Promise<InterfaceDictionary>>();

export function loadInterfaceDictionary(locale: Locale): Promise<InterfaceDictionary> {
  if (locale === "en") return Promise.resolve({});
  const cached = cache.get(locale);
  if (cached) return cached;
  const request = loaders[locale]?.() ?? Promise.resolve({});
  cache.set(locale, request);
  return request;
}
