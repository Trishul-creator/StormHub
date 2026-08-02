import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { AssignmentCard } from "@/components/coursework/assignment-card";
import type { ClubAssignment } from "@/types/database";

const pastAssignment: ClubAssignment = {
  id: "assignment-1",
  club_id: "club-1",
  title: "Past reflection",
  instructions: "Submit your reflection.",
  due_at: "2020-01-01T12:00:00.000Z",
  points_possible: 10,
  submission_mode: "submission",
  status: "published",
  created_at: "2020-01-01T00:00:00.000Z",
  updated_at: "2020-01-01T00:00:00.000Z",
};

describe("AssignmentCard", () => {
  it("uses red overdue styling for students", () => {
    render(<AssignmentCard assignment={pastAssignment} href="/assignments/assignment-1" />);

    expect(screen.getByText("Past due")).toHaveClass("bg-red-100", "text-red-800");
  });

  it("keeps the same overdue status neutral for teachers", () => {
    render(
      <AssignmentCard
        assignment={pastAssignment}
        href="/manage/assignments/assignment-1"
        managerView
      />
    );

    expect(screen.getByText("Past due")).toHaveClass("bg-storm-light/70", "text-storm-blue");
    expect(screen.getByText("Past due")).not.toHaveClass("bg-red-100", "text-red-800");
  });
});
