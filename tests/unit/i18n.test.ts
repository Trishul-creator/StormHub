import { describe, expect, it } from "vitest";
import { getLocaleDirection, normalizeLocale, translate } from "@/lib/i18n/config";
import { translateInterfaceText } from "@/lib/i18n/interface-phrases";

describe("internationalization", () => {
  it("normalizes supported regional locales and safely falls back to English", () => {
    expect(normalizeLocale("es-MX")).toBe("es");
    expect(normalizeLocale(" EN-us ")).toBe("en");
    expect(normalizeLocale("it")).toBe("en");
    expect(normalizeLocale(undefined)).toBe("en");
  });

  it("supports regional forms of every interface language", () => {
    expect(normalizeLocale("fr-CA")).toBe("fr");
    expect(normalizeLocale("zh-CN")).toBe("zh");
    expect(normalizeLocale("ar-SA")).toBe("ar");
    expect(normalizeLocale("hi-IN")).toBe("hi");
    expect(normalizeLocale("de-DE")).toBe("de");
    expect(normalizeLocale("pt-BR")).toBe("pt");
    expect(normalizeLocale("vi-VN")).toBe("vi");
    expect(normalizeLocale("ja-JP")).toBe("ja");
    expect(normalizeLocale("ko-KR")).toBe("ko");
    expect(getLocaleDirection("ar")).toBe("rtl");
    expect(getLocaleDirection("fr")).toBe("ltr");
  });

  it("translates labels and interpolates values", () => {
    expect(translate("es", "common.opportunities")).toBe("Oportunidades");
    expect(translate("es", "home.exploreSchool", { school: "Central High" })).toBe(
      "Explorar Central High",
    );
  });

  it("translates hard-coded feature text and dynamic counts", () => {
    expect(translateInterfaceText("Club Directory", "fr")).toBe("Répertoire des clubs");
    expect(translateInterfaceText("12 members", "zh")).toBe("12 名成员");
    expect(translateInterfaceText("  Dashboard  ", "ar")).toBe("  لوحة المعلومات  ");
  });
});
