import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { LanguageSettings, LanguageSwitcher } from "@/components/i18n/language-controls";
import { LanguageProvider } from "@/components/i18n/language-provider";

const refresh = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh }),
}));

describe("language preferences", () => {
  beforeEach(() => {
    refresh.mockReset();
    document.cookie = "stormhub-locale=; Path=/; Max-Age=0";
    document.documentElement.lang = "en";
  });

  it("persists Spanish and applies it immediately", () => {
    render(
      <LanguageProvider initialLocale="en">
        <LanguageSettings />
      </LanguageProvider>,
    );

    fireEvent.click(screen.getByRole("radio", { name: /spanish/i }));

    expect(document.cookie).toContain("stormhub-locale=es");
    expect(document.documentElement.lang).toBe("es");
    expect(screen.getByText(/contenido creado por la escuela/i)).toBeInTheDocument();
    expect(refresh).toHaveBeenCalledOnce();
  });

  it("offers the current languages from the compact navigation control", () => {
    render(
      <LanguageProvider initialLocale="es">
        <LanguageSwitcher showLabel />
      </LanguageProvider>,
    );

    expect(screen.getByText("Idioma")).toBeInTheDocument();
    expect(screen.getByRole("combobox", { name: "Cambiar idioma" })).toHaveValue("es");
    expect(screen.getByRole("option", { name: "English" })).toBeInTheDocument();
    expect(screen.getByRole("option", { name: "Español" })).toBeInTheDocument();
  });
});
