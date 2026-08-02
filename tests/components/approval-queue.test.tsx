import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { ApprovalQueue } from "@/components/manage/approval-queue";

describe("ApprovalQueue", () => {
  it("opens pending moderation content as a read-only platform view", () => {
    render(
      <ApprovalQueue
        items={[{
          id: "announcement-1",
          type: "announcement",
          title: "Meeting update",
          context: "Robotics Club",
          submitted_at: "2026-08-02T12:00:00.000Z",
        }]}
        actionsEnabled={false}
      />
    );

    expect(screen.getByText("Meeting update")).toBeVisible();
    expect(screen.getByText("Robotics Club", { exact: false })).toBeVisible();
    expect(screen.getByText("Read-only platform view")).toBeVisible();
    expect(screen.queryByRole("button", { name: "Approve" })).not.toBeInTheDocument();
  });
});
