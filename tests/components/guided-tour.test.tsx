import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { useState } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { GuidedTour } from "@/components/onboarding/guided-tour";
import { GuidedTourSettings } from "@/components/settings/guided-tour-settings";

const tourKey = "stormhub:tour:pilot-v2:user-1:student:initial";

function TourTargets() {
  return (
    <>
      <a href="/" data-tour="brand">StormHub</a>
      <a href="/dashboard" data-tour="primary-nav">Dashboard</a>
      <a href="/clubs" data-tour="clubs-nav">Clubs</a>
      <main data-tour="role-overview">Dashboard overview</main>
      <button data-tour="settings">Settings</button>
    </>
  );
}

function InteractiveTourTargets() {
  const [page, setPage] = useState<"dashboard" | "clubs">("dashboard");

  return (
    <>
      <a href="/" data-tour="brand">StormHub</a>
      <button data-tour="mobile-menu">Menu</button>
      <button data-tour="primary-nav">Dashboard</button>
      <button data-tour="clubs-nav" onClick={() => setPage("clubs")}>Clubs</button>
      {page === "dashboard" ? (
        <>
          <main data-tour="role-overview">Dashboard overview</main>
          <section data-tour="role-checklist">Launch checklist</section>
          <section data-tour="student-clubs">Joined clubs</section>
          <section data-tour="student-classwork">Classwork</section>
        </>
      ) : (
        <>
          <section data-tour="club-directory-tools">Search and filters</section>
          <section data-tour="club-directory-results">Club results</section>
        </>
      )}
    </>
  );
}

describe("guided walkthrough", () => {
  beforeEach(() => {
    window.localStorage.clear();
    window.history.replaceState({}, "", "/dashboard");
    Object.defineProperty(HTMLElement.prototype, "scrollIntoView", {
      configurable: true,
      value: vi.fn(),
    });
    vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockImplementation(() => ({
      x: 24,
      y: 24,
      top: 24,
      left: 24,
      right: 224,
      bottom: 72,
      width: 200,
      height: 48,
      toJSON: () => ({}),
    }));
  });

  it("automatically introduces new users and remembers completion", async () => {
    const view = render(
      <>
        <TourTargets />
        <GuidedTour
          userId="user-1"
          role="student"
          canManage={false}
          autoStart
        />
      </>
    );

    expect(await screen.findByRole("dialog", {}, { timeout: 2000 })).toBeVisible();
    expect(screen.getByRole("heading", { name: "Welcome to StormHub" })).toBeVisible();

    fireEvent.click(screen.getByRole("button", { name: /next/i }));
    await waitFor(() => {
      expect(screen.getByRole("heading", { name: "Your dashboard" })).toBeVisible();
    });

    fireEvent.click(screen.getByRole("button", { name: "Skip tour" }));
    expect(window.localStorage.getItem(tourKey)).toBe("complete");
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();

    view.unmount();
    render(
      <>
        <TourTargets />
        <GuidedTour
          userId="user-1"
          role="student"
          canManage={false}
          autoStart
        />
      </>
    );
    await new Promise((resolve) => window.setTimeout(resolve, 800));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("offers a role-aware replay link from Settings", () => {
    const { rerender } = render(<GuidedTourSettings role="student" />);
    expect(screen.getByRole("link", { name: /replay walkthrough/i })).toHaveAttribute(
      "href",
      "/dashboard?tour=1"
    );

    rerender(<GuidedTourSettings role="admin" />);
    expect(screen.getByRole("link", { name: /replay walkthrough/i })).toHaveAttribute(
      "href",
      "/manage?tour=1"
    );
  });

  it("requires users to open a top-level destination and follows the page change", async () => {
    render(
      <>
        <InteractiveTourTargets />
        <GuidedTour
          userId="user-1"
          role="student"
          canManage={false}
          autoStart
        />
      </>
    );

    expect(await screen.findByRole("heading", { name: "Welcome to StormHub" })).toBeVisible();
    for (const heading of [
      "Your dashboard",
      "Your launch checklist",
      "Your club workspaces",
      "Your upcoming classwork",
    ]) {
      fireEvent.click(screen.getByRole("button", { name: /next/i }));
      expect(await screen.findByRole("heading", { name: heading })).toBeVisible();
    }

    fireEvent.click(screen.getByRole("button", { name: /next/i }));
    expect(await screen.findByRole("heading", { name: "Open the main menu" })).toBeVisible();
    fireEvent.click(screen.getByRole("button", { name: "Open menu" }));
    expect(await screen.findByRole("heading", { name: "Open the club directory" })).toBeVisible();
    fireEvent.click(screen.getByRole("button", { name: "Open Clubs" }));

    expect(await screen.findByRole("heading", { name: "Search and filter clubs" })).toBeVisible();
    expect(screen.getByText("Club results")).toBeVisible();
    expect(window.localStorage.getItem(tourKey)).toContain('"status":"active"');
  });
});
