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
      const malformed: string[] = [];
      for (const source of sourceKeys) {
        const translation = dictionary[source];
        expect(translation).toBeTruthy();
        const sourceSlots = [...source.matchAll(/\{[^}]+\}/g)].map((match) => match[0]).sort();
        const translationSlots = [...translation.matchAll(/\{[^}]+\}/g)].map((match) => match[0]).sort();
        expect(translationSlots).toEqual(sourceSlots);
        if (source.includes("StormHub")) expect(translation).toContain("StormHub");

        const tokens = translation.trim().split(/\s+/);
        const uniqueTokenRatio = new Set(tokens).size / tokens.length;
        const excessiveRepetition = tokens.length >= 20 && uniqueTokenRatio < 0.35;
        const excessivePunctuation = (translation.match(/[.!؟。、]{1,3}/g) ?? []).length >= 30;
        const excessiveLength = translation.length > Math.max(500, source.length * 5);
        const generatorArtifact = /ZXQ|QXZ|\\pos|#{10,}/.test(translation);
        if (excessiveRepetition || excessivePunctuation || excessiveLength || generatorArtifact) {
          malformed.push(source);
        }
      }
      expect(malformed).toEqual([]);
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
    expect(translateInterfaceText("Sep 14, 2026", "de", german)).not.toBe("Sep 14, 2026");
    expect(translateInterfaceText("Sep 14, 2026", "de", german)).not.toBe("Sep 14, 2026");
    expect(translateInterfaceText("8/15/2026, 7:30 PM", "de", german)).not.toBe(
      "8/15/2026, 7:30 PM",
    );
    expect(
      translateInterfaceText(
        "A student-built opportunity hub designed to help students find their next step.",
        "de",
        german,
      ),
    ).not.toBe("A student-built opportunity hub designed to help students find their next step.");
  });

  it("uses localized core navigation and role labels in every newer language", async () => {
    for (const locale of ["de", "pt", "vi", "ja", "ko"] as const) {
      const dictionary = await loadInterfaceDictionary(locale);
      for (const source of [
        "Clubs",
        "Dashboard",
        "Notifications",
        "Teacher",
        "Vice President",
        "Assignments",
        "Attendance",
        "Walkthrough",
      ]) {
        expect(translateInterfaceText(source, locale, dictionary)).not.toBe(source);
      }
    }
  });
});
