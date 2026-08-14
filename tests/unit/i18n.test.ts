import { describe, expect, it } from "vitest";
import { normalizeLocale, translate } from "@/lib/i18n/config";

describe("internationalization", () => {
  it("normalizes supported regional locales and safely falls back to English", () => {
    expect(normalizeLocale("es-MX")).toBe("es");
    expect(normalizeLocale(" EN-us ")).toBe("en");
    expect(normalizeLocale("fr")).toBe("en");
    expect(normalizeLocale(undefined)).toBe("en");
  });

  it("translates labels and interpolates values", () => {
    expect(translate("es", "common.opportunities")).toBe("Oportunidades");
    expect(translate("es", "home.exploreSchool", { school: "Central High" })).toBe(
      "Explorar Central High",
    );
  });
});
