import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { RoleChecklist } from "@/components/dashboard/role-checklist";

describe("RoleChecklist", () => {
  it("renders progress and disables locked actions", () => {
    render(
      <RoleChecklist
        items={[
          {
            id: "done",
            label: "Join a club",
            description: "Join one club.",
            href: "/clubs",
            status: "done",
          },
          {
            id: "locked",
            label: "Manage roster",
            description: "Requires a sponsored club.",
            href: "/manage/clubs",
            status: "locked",
          },
        ]}
      />
    );

    expect(screen.getByText("1/2 complete")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "View" })).toHaveAttribute("href", "/clubs");
    expect(screen.getByRole("button", { name: "Locked" })).toBeDisabled();
  });
});
