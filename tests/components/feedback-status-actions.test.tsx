import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { FeedbackStatusActions } from "@/components/admin/feedback-status-actions";
import { respondToFeedback, updateFeedbackStatus } from "@/lib/actions";

const refresh = vi.fn();
const toast = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh }),
}));

vi.mock("@/hooks/use-toast", () => ({
  toast: (...args: unknown[]) => toast(...args),
}));

vi.mock("@/lib/actions", () => ({
  respondToFeedback: vi.fn(),
  updateFeedbackStatus: vi.fn(),
}));

describe("FeedbackStatusActions", () => {
  beforeEach(() => {
    vi.mocked(updateFeedbackStatus).mockResolvedValue({ success: true });
    vi.mocked(respondToFeedback).mockResolvedValue({ success: true });
    refresh.mockReset();
    toast.mockReset();
  });

  it("supports status triage without offering an email reply when no address exists", async () => {
    render(
      <FeedbackStatusActions
        id="feedback-1"
        schoolId="school-1"
        status="open"
        canReply={false}
      />
    );

    expect(screen.queryByPlaceholderText(/write a response/i)).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Mark reviewed" }));

    await waitFor(() => {
      expect(updateFeedbackStatus).toHaveBeenCalledWith("feedback-1", "reviewed", "school-1");
    });
    expect(refresh).toHaveBeenCalled();
  });

  it("keeps replies inside the explicitly selected school scope", async () => {
    render(
      <FeedbackStatusActions
        id="feedback-1"
        schoolId="school-1"
        status="open"
        canReply
      />
    );

    fireEvent.change(screen.getByPlaceholderText(/write a response/i), {
      target: { value: "We fixed the issue." },
    });
    fireEvent.click(screen.getByRole("button", { name: /queue response/i }));

    await waitFor(() => {
      expect(respondToFeedback).toHaveBeenCalledWith(
        "feedback-1",
        "We fixed the issue.",
        "school-1"
      );
    });
  });
});
