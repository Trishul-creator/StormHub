import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { DashboardPriorityPanel } from "@/components/dashboard/priority-panel";

describe("DashboardPriorityPanel", () => {
  it("renders a calm caught-up state", () => {
    render(<DashboardPriorityPanel items={[]} />);

    expect(screen.getByText("You’re caught up")).toBeVisible();
    expect(screen.getByText(/nothing time-sensitive/i)).toBeVisible();
  });

  it("shows concise actionable rows with dark-mode-safe urgency colors", () => {
    const { container } = render(
      <DashboardPriorityPanel
        items={[
          {
            id: "assignment:1",
            kind: "assignment",
            urgency: "urgent",
            title: "Project reflection",
            detail: "Robotics",
            timing: "Due today",
            href: "/assignment/1",
            actionLabel: "Open assignment",
            score: 0,
          },
        ]}
        allHref="/calendar"
      />
    );

    expect(screen.getByRole("link", { name: "Open assignment" })).toHaveAttribute(
      "href",
      "/assignment/1"
    );
    expect(screen.getByRole("link", { name: /view everything/i })).toHaveAttribute(
      "href",
      "/calendar"
    );
    expect(container.querySelector(".dark\\:text-red-200")).toBeInTheDocument();
  });
});
