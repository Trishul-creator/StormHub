import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { AssignmentForm } from "@/components/coursework/assignment-form";
import { ClubPostComposer } from "@/components/manage/club-post-composer";
import { SubmissionForm } from "@/components/coursework/submission-form";
import { GradeSubmissionForm } from "@/components/coursework/grade-submission-form";
import {
  createClubAssignment,
  gradeClubAssignmentSubmission,
  submitClubAssignment,
} from "@/lib/actions";
import type { ClubAssignmentSubmission } from "@/types/database";

const refresh = vi.fn();
const toast = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh }),
}));

vi.mock("@/hooks/use-toast", () => ({
  toast: (...args: unknown[]) => toast(...args),
}));

vi.mock("@/lib/actions", () => ({
  createClubAssignment: vi.fn(),
  prepareCourseworkFileUpload: vi.fn(),
  registerAssignmentGoogleDriveAttachment: vi.fn(),
  registerCourseworkFileUpload: vi.fn(),
  registerSubmissionGoogleDriveAttachment: vi.fn(),
  removeCourseworkAttachment: vi.fn(),
  updateClubAssignmentStatus: vi.fn(),
  gradeClubAssignmentSubmission: vi.fn(),
  submitClubAssignment: vi.fn(),
  submitContent: vi.fn(),
}));

const submission: ClubAssignmentSubmission = {
  id: "submission-1",
  assignment_id: "assignment-1",
  student_id: "student-1",
  submission_text: "Initial response",
  attachment_url: "https://example.com/work",
  status: "submitted",
  submitted_at: "2026-07-26T12:00:00.000Z",
  grade_points: null,
  feedback: null,
  created_at: "2026-07-26T12:00:00.000Z",
  updated_at: "2026-07-26T12:00:00.000Z",
};

describe("club coursework controls", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(createClubAssignment).mockResolvedValue({ success: true, assignmentId: "assignment-1" });
    vi.mocked(submitClubAssignment).mockResolvedValue({ success: true });
    vi.mocked(gradeClubAssignmentSubmission).mockResolvedValue({ success: true });
  });

  it("creates and publishes a points-based club assignment", async () => {
    render(<AssignmentForm clubSlug="science-bowl" />);

    fireEvent.change(screen.getByLabelText("Assignment title"), {
      target: { value: "Practice reflection" },
    });
    fireEvent.change(screen.getByLabelText("Instructions"), {
      target: { value: "Explain two topics to review." },
    });
    fireEvent.change(screen.getByLabelText("Points possible"), {
      target: { value: "20" },
    });
    fireEvent.change(screen.getByLabelText(/instructions or resource link/i), {
      target: { value: "https://example.com/questions" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Publish assignment" }));

    await waitFor(() => {
      expect(createClubAssignment).toHaveBeenCalledWith(
        expect.objectContaining({
          clubSlug: "science-bowl",
          title: "Practice reflection",
          instructions: "Explain two topics to review.",
          pointsPossible: 20,
          attachmentUrl: "https://example.com/questions",
          submissionMode: "submission",
          publishNow: true,
        })
      );
    });
    expect(refresh).toHaveBeenCalled();
  });

  it("switches the unified publishing surface from announcements to assignments", () => {
    render(<ClubPostComposer clubSlug="science-bowl" />);

    expect(screen.getByText("Share an update with every club member.")).toBeVisible();
    fireEvent.click(screen.getByRole("button", { name: "Assignment" }));

    expect(screen.getByText("Collect work, return feedback, and grade.")).toBeVisible();
    expect(screen.getByLabelText("Assignment title")).toBeVisible();
  });

  it("submits or resubmits only the student's own response", async () => {
    render(
      <SubmissionForm
        clubSlug="science-bowl"
        assignmentId="assignment-1"
        submission={submission}
      />
    );

    fireEvent.change(screen.getByLabelText("Your response"), {
      target: { value: "Updated response" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Resubmit assignment" }));

    await waitFor(() => {
      expect(submitClubAssignment).toHaveBeenCalledWith({
        clubSlug: "science-bowl",
        assignmentId: "assignment-1",
        submissionText: "Updated response",
        attachmentUrl: "https://example.com/work",
      });
    });
  });

  it("lets students mark completion-only work complete without an attachment", async () => {
    render(
      <SubmissionForm
        clubSlug="science-bowl"
        assignmentId="assignment-2"
        submissionMode="completion"
      />
    );

    expect(screen.getByText("No file or written response is required.")).toBeVisible();
    fireEvent.click(screen.getByRole("button", { name: "Mark as complete" }));

    await waitFor(() => {
      expect(submitClubAssignment).toHaveBeenCalledWith({
        clubSlug: "science-bowl",
        assignmentId: "assignment-2",
        submissionText: "",
        attachmentUrl: "",
      });
    });
  });

  it("returns a private grade and feedback to one submission", async () => {
    render(
      <GradeSubmissionForm
        clubSlug="science-bowl"
        assignmentId="assignment-1"
        submission={submission}
        pointsPossible={20}
      />
    );

    fireEvent.change(screen.getByLabelText("Points"), { target: { value: "18" } });
    fireEvent.change(screen.getByLabelText("Private feedback"), {
      target: { value: "Strong reasoning." },
    });
    fireEvent.click(screen.getByRole("button", { name: "Return grade" }));

    await waitFor(() => {
      expect(gradeClubAssignmentSubmission).toHaveBeenCalledWith({
        clubSlug: "science-bowl",
        assignmentId: "assignment-1",
        submissionId: "submission-1",
        gradePoints: 18,
        feedback: "Strong reasoning.",
      });
    });
  });
});
