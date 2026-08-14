import "server-only";

import { cookies } from "next/headers";
import {
  LOCALE_COOKIE,
  normalizeLocale,
  translate,
  type TranslationKey,
  type TranslationValues,
} from "@/lib/i18n/config";

export async function getRequestLocale() {
  const cookieStore = await cookies();
  return normalizeLocale(cookieStore.get(LOCALE_COOKIE)?.value);
}

export async function getServerTranslator() {
  const locale = await getRequestLocale();
  return {
    locale,
    t: (key: TranslationKey, values?: TranslationValues) =>
      translate(locale, key, values),
  };
}
