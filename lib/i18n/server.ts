import "server-only";

import { cookies, headers } from "next/headers";
import {
  LOCALE_COOKIE,
  isLocale,
  normalizeLocale,
  translate,
  type TranslationKey,
  type TranslationValues,
} from "@/lib/i18n/config";

export async function getRequestLocale() {
  const cookieStore = await cookies();
  const savedLocale = cookieStore.get(LOCALE_COOKIE)?.value;
  if (isLocale(savedLocale)) return savedLocale;

  const requestHeaders = await headers();
  const acceptedLanguages = requestHeaders.get("accept-language")?.split(",") ?? [];
  for (const language of acceptedLanguages) {
    const candidate = language.split(";")[0]?.trim();
    const normalized = normalizeLocale(candidate);
    if (candidate && isLocale(candidate.toLowerCase().split("-")[0])) return normalized;
  }
  return normalizeLocale(undefined);
}

export async function getServerTranslator() {
  const locale = await getRequestLocale();
  return {
    locale,
    t: (key: TranslationKey, values?: TranslationValues) =>
      translate(locale, key, values),
  };
}
