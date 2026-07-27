import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { AssignmentForm } from "@/components/coursework/assignment-form";
import { ClubCreateNavigation } from "@/components/manage/club-create-navigation";
import { SubmissionForm } from "@/components/coursework/submission-form";
import { GradeSubmissionForm } from "@/components/coursework/grade-submission-form";
import { ContentForm } from "@/components/forms/content-form";
import {
  createClubAssignment,
  gradeClubAssignmentSubmission,
  submitContent,
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
    vi.mocked(submitContent).mockResolvedValue({ success: true, approved: true });
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

  it("keeps creation types in one contextual menu without duplicating their forms", () => {
    render(<ClubCreateNavigation clubSlug="science-bowl" activeType="announcement" />);

    expect(screen.getByText("Share an update with every club member.")).toBeVisible();
    expect(screen.getByRole("link", { name: "Announcement" })).toHaveAttribute("aria-current", "page");
    expect(screen.getByRole("link", { name: "Assignment" })).toHaveAttribute(
      "href",
      "/manage/clubs/science-bowl/coursework"
    );
    expect(screen.queryByLabelText("Assignment title")).not.toBeInTheDocument();
  });

  it("saves an assignment as a scheduled private draft", async () => {
    render(<AssignmentForm clubSlug="science-bowl" />);

    fireEvent.change(screen.getByLabelText("Assignment title"), {
      target: { value: "Scheduled practice" },
    });
    fireEvent.click(screen.getByRole("radio", { name: /^schedule/i }));
    fireEvent.change(screen.getByLabelText(/release date and time/i), {
      target: { value: "2099-01-02T09:30" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Schedule assignment" }));

    await waitFor(() => {
      expect(createClubAssignment).toHaveBeenCalledWith(
        expect.objectContaining({
          clubSlug: "science-bowl",
          title: "Scheduled practice",
          publishNow: false,
          scheduledFor: "2099-01-02T09:30",
        })
      );
    });
  });

  it("keeps Vice President assignments in draft review", async () => {
    render(<AssignmentForm clubSlug="science-bowl" canPublish={false} />);

    expect(screen.getByText(/Vice Presidents can prepare assignment drafts/i)).toBeVisible();
    expect(screen.queryByRole("radio", { name: /^schedule/i })).not.toBeInTheDocument();
    fireEvent.change(screen.getByLabelText("Assignment title"), {
      target: { value: "Member reflection" },
    });
    fireEvent.click(screen.getByRole("button", { name: /save draft/i }));

    await waitFor(() => {
      expect(createClubAssignment).toHaveBeenCalledWith(
        expect.objectContaining({
          clubSlug: "science-bowl",
          title: "Member reflection",
          publishNow: false,
          scheduledFor: null,
        })
      );
    });
  });

  it("schedules an announcement instead of notifying members immediately", async () => {
    vi.mocked(submitContent).mockResolvedValue({ success: true, approved: true, scheduled: true });
    render(<ContentForm type="announcement" clubSlug="science-bowl" />);

    fireEvent.change(screen.getByLabelText("Title"), { target: { value: "Tomorrow's update" } });
    fireEvent.change(screen.getByLabelText("Content"), { target: { value: "Bring safety glasses." } });
    fireEvent.click(screen.getByRole("radio", { name: /schedule for later/i }));
    fireEvent.change(screen.getByLabelText("Release date and time"), {
      target: { value: "2099-01-02T09:30" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Schedule Announcement" }));

    await waitFor(() => {
      expect(submitContent).toHaveBeenCalledWith(
        expect.objectContaining({
          type: "announcement",
          release_at: "2099-01-02T09:30",
        })
      );
    });
  });

  it("keeps Vice President announcements in the approval workflow", async () => {
    vi.mocked(submitContent).mockResolvedValue({ success: true, approved: false });
    render(<ContentForm type="announcement" clubSlug="science-bowl" canPublish={false} />);

    expect(screen.getByText(/Vice Presidents can prepare drafts/i)).toBeVisible();
    expect(screen.queryByRole("radio", { name: /schedule for later/i })).not.toBeInTheDocument();
    expect(screen.queryByText("Queue email notification")).not.toBeInTheDocument();

    fireEvent.change(screen.getByLabelText("Title"), { target: { value: "Prepared update" } });
    fireEvent.change(screen.getByLabelText("Content"), { target: { value: "Ready for review." } });
    fireEvent.click(screen.getByRole("button", { name: "Create Announcement" }));

    await waitFor(() => {
      expect(submitContent).toHaveBeenCalledWith(
        expect.objectContaining({
          type: "announcement",
          clubSlug: "science-bowl",
          send_email_to_members: false,
          release_at: undefined,
        })
      );
    });
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
