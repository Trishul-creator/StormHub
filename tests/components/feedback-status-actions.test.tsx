import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { FeedbackStatusActions } from "@/components/admin/feedback-status-actions";
import { updateFeedbackStatus } from "@/lib/actions";

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
    refresh.mockReset();
    toast.mockReset();
  });

  it("supports status triage without offering an email reply when no address exists", async () => {
    render(<FeedbackStatusActions id="feedback-1" status="open" canReply={false} />);

    expect(screen.queryByPlaceholderText(/write a response/i)).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Mark reviewed" }));

    await waitFor(() => {
      expect(updateFeedbackStatus).toHaveBeenCalledWith("feedback-1", "reviewed");
    });
    expect(refresh).toHaveBeenCalled();
  });
});
