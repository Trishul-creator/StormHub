import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { useState } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { buildTourSteps, GuidedTour } from "@/components/onboarding/guided-tour";
import { GuidedTourSettings } from "@/components/settings/guided-tour-settings";

const tourKey = "stormhub:tour:pilot-v3:user-1:student:initial";
const navigationState = vi.hoisted(() => ({ pathname: "/dashboard" }));

vi.mock("next/navigation", () => ({
  usePathname: () => navigationState.pathname,
}));

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
          <section data-tour="dashboard-priorities">Priority queue</section>
          <section data-tour="dashboard-summary">Quick summary</section>
          <section data-tour="role-checklist">Launch checklist</section>
          <section data-tour="student-clubs">Joined clubs</section>
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
    navigationState.pathname = "/dashboard";
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

  it("builds a distinct walkthrough for every platform role", () => {
    const titles = (role: Parameters<typeof buildTourSteps>[0]) =>
      buildTourSteps(role, false).map((step) => step.title);

    expect(titles("student")).toContain("Your club workspaces");
    expect(titles("teacher")).toContain("Advisor-wide tools");
    expect(titles("admin")).toContain("School administration menu");
    expect(titles("district_admin")).toContain("District statistics");
    expect(titles("super_admin")).toContain("Production health");
    expect(new Set([
      titles("student").join("|"),
      titles("teacher").join("|"),
      titles("admin").join("|"),
      titles("district_admin").join("|"),
      titles("super_admin").join("|"),
    ]).size).toBe(5);
  });

  it("waits until account setup is complete before starting automatically", async () => {
    navigationState.pathname = "/auth/complete-profile";
    const view = render(
      <>
        <TourTargets />
        <GuidedTour userId="user-1" role="student" canManage={false} autoStart />
      </>
    );

    await new Promise((resolve) => window.setTimeout(resolve, 500));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(window.localStorage.getItem(tourKey)).toBeNull();

    navigationState.pathname = "/dashboard";
    view.rerender(
      <>
        <TourTargets />
        <GuidedTour userId="user-1" role="student" canManage={false} autoStart />
      </>
    );

    expect(await screen.findByRole("dialog", {}, { timeout: 2000 })).toBeVisible();
    expect(screen.getByRole("heading", { name: "Welcome to StormHub" })).toBeVisible();
  });

  it("keeps an unavailable step visible instead of rapidly skipping ahead", async () => {
    render(
      <>
        <TourTargets />
        <GuidedTour userId="user-1" role="student" canManage={false} autoStart />
      </>
    );

    expect(await screen.findByRole("heading", { name: "Welcome to StormHub" })).toBeVisible();
    fireEvent.click(screen.getByRole("button", { name: /next/i }));
    expect(await screen.findByRole("heading", { name: "Your dashboard" })).toBeVisible();
    fireEvent.click(screen.getByRole("button", { name: /next/i }));

    expect(await screen.findByText(/tour will not skip ahead on its own/i, {}, { timeout: 3000 })).toBeVisible();
    expect(screen.getByRole("heading", { name: "Start with what needs attention" })).toBeVisible();
    await new Promise((resolve) => window.setTimeout(resolve, 600));
    expect(screen.getByRole("heading", { name: "Start with what needs attention" })).toBeVisible();
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
      "Start with what needs attention",
      "Use the quick summary",
      "Open setup only when needed",
      "Your club workspaces",
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
