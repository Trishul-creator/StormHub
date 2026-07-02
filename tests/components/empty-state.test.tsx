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
});
