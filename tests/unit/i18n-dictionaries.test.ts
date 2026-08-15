import { describe, expect, it } from "vitest";
import { loadInterfaceDictionary } from "@/lib/i18n/interface-dictionaries";
import { translateInterfaceText } from "@/lib/i18n/interface-phrases";
import type { Locale } from "@/lib/i18n/config";

const translatedLocales: Locale[] = [
  "es", "fr", "zh", "ar", "hi", "de", "pt", "vi", "ja", "ko",
];

describe("complete interface dictionaries", () => {
  it("ships the same exhaustive source catalog for every translated locale", async () => {
    const dictionaries = await Promise.all(translatedLocales.map(loadInterfaceDictionary));
    const sourceKeys = Object.keys(dictionaries[0]).sort();

    expect(sourceKeys.length).toBeGreaterThan(2_500);
    dictionaries.forEach((dictionary) => {
      expect(Object.keys(dictionary).sort()).toEqual(sourceKeys);
      for (const source of sourceKeys) {
        const translation = dictionary[source];
        expect(translation).toBeTruthy();
        const sourceSlots = [...source.matchAll(/\{[^}]+\}/g)].map((match) => match[0]).sort();
        const translationSlots = [...translation.matchAll(/\{[^}]+\}/g)].map((match) => match[0]).sort();
        expect(translationSlots).toEqual(sourceSlots);
        if (source.includes("StormHub")) expect(translation).toContain("StormHub");
      }
    });
  });

  it("translates exact and interpolated feature text in newly added languages", async () => {
    const german = await loadInterfaceDictionary("de");
    const japanese = await loadInterfaceDictionary("ja");

    expect(translateInterfaceText("Manage school clubs", "de", german)).not.toBe(
      "Manage school clubs",
    );
    const dynamic = translateInterfaceText(
      "Your role in Robotics Club is now President.",
      "ja",
      japanese,
    );
    expect(dynamic).toContain("Robotics Club");
    expect(dynamic).toContain("President");
    expect(dynamic).not.toBe("Your role in Robotics Club is now President.");
  });
});
