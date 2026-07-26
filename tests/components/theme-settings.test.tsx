import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ThemeSettings } from "@/components/theme/theme-controls";

describe("ThemeSettings", () => {
  beforeEach(() => {
    window.localStorage.clear();
    document.documentElement.classList.remove("dark");
    Object.defineProperty(window, "matchMedia", {
      writable: true,
      value: vi.fn().mockImplementation(() => ({
        matches: false,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
      })),
    });
  });

  it("persists dark mode and applies it immediately", () => {
    render(<ThemeSettings />);
    fireEvent.click(screen.getByRole("radio", { name: /dark/i }));
    expect(window.localStorage.getItem("stormhub-theme")).toBe("dark");
    expect(document.documentElement).toHaveClass("dark");
  });

  it("supports following the system preference", () => {
    render(<ThemeSettings />);
    fireEvent.click(screen.getByRole("radio", { name: /system/i }));
    expect(window.localStorage.getItem("stormhub-theme")).toBe("system");
  });
});
