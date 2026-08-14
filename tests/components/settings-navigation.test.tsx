import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { SettingsNavigation } from "@/components/settings/settings-navigation";

describe("SettingsNavigation", () => {
  it("links to every settings section and updates the active location", () => {
    render(<SettingsNavigation />);

    expect(screen.getByRole("navigation", { name: "Settings sections" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /profile/i })).toHaveAttribute("href", "#profile");
    expect(screen.getByRole("link", { name: /notifications/i })).toHaveAttribute("href", "#notifications");
    expect(screen.getByRole("link", { name: /language/i })).toHaveAttribute("href", "#language");

    const accountLink = screen.getByRole("link", { name: /account & privacy/i });
    expect(accountLink).toHaveAttribute("href", "#account");

    fireEvent.click(accountLink);

    expect(accountLink).toHaveAttribute("aria-current", "location");
    expect(screen.getByRole("link", { name: /profile/i })).not.toHaveAttribute("aria-current");
  });
});
