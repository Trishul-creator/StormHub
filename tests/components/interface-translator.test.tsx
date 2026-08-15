import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { InterfaceTranslator } from "@/components/i18n/interface-translator";
import { LanguageSwitcher } from "@/components/i18n/language-controls";
import { LanguageProvider } from "@/components/i18n/language-provider";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: vi.fn() }),
}));

describe("InterfaceTranslator", () => {
  it("translates feature-page text and attributes when language changes", async () => {
    render(
      <LanguageProvider initialLocale="en">
        <InterfaceTranslator />
        <LanguageSwitcher showLabel />
        <h1>Club Directory</h1>
        <input aria-label="Search clubs" placeholder="Search clubs" />
        <p data-no-translate>Club Directory</p>
      </LanguageProvider>,
    );

    fireEvent.change(screen.getByRole("combobox", { name: "Change language" }), {
      target: { value: "fr" },
    });

    await waitFor(() => {
      expect(screen.getByRole("heading", { name: "Répertoire des clubs" })).toBeVisible();
    });
    expect(screen.getByRole("textbox", { name: "Rechercher des clubs" })).toHaveAttribute(
      "placeholder",
      "Rechercher des clubs",
    );
    expect(screen.getByText("Club Directory")).toHaveAttribute("data-no-translate");
  });

  it("applies right-to-left document direction for Arabic", async () => {
    render(
      <LanguageProvider initialLocale="en">
        <InterfaceTranslator />
        <LanguageSwitcher />
      </LanguageProvider>,
    );

    fireEvent.change(screen.getByRole("combobox", { name: "Change language" }), {
      target: { value: "ar" },
    });

    await waitFor(() => expect(document.documentElement).toHaveAttribute("dir", "rtl"));
    expect(document.documentElement).toHaveAttribute("lang", "ar");
  });
});
