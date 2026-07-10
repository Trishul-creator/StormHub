import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { EmptyState } from "@/components/layout/empty-state";

describe("EmptyState", () => {
  it("renders polished empty text and optional action", () => {
    render(
      <EmptyState
        title="No draft clubs"
        description="Draft clubs will appear here before they are published."
        actionLabel="Create draft"
        actionHref="/manage/clubs/new"
      />
    );

    expect(screen.getByText("No draft clubs")).toBeInTheDocument();
    expect(screen.getByText("Draft clubs will appear here before they are published.")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Create draft" })).toHaveAttribute("href", "/manage/clubs/new");
  });

  it("renders multiple recovery actions", () => {
    render(
      <EmptyState
        title="No clubs found"
        description="Try a broader search."
        actions={[
          { label: "Clear filters", href: "/clubs" },
          { label: "Search everything", href: "/search?q=robotics" },
        ]}
      />
    );

    expect(screen.getByRole("link", { name: "Clear filters" })).toHaveAttribute("href", "/clubs");
    expect(screen.getByRole("link", { name: "Search everything" })).toHaveAttribute("href", "/search?q=robotics");
  });
});
