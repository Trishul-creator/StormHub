import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { AccountControls } from "@/components/settings/account-controls";
import { requestAccountDeletion } from "@/lib/actions";

const refresh = vi.fn();
const toast = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh }),
}));

vi.mock("@/hooks/use-toast", () => ({
  toast: (...args: unknown[]) => toast(...args),
}));

vi.mock("@/lib/actions", () => ({
  requestAccountDeletion: vi.fn(),
}));

describe("AccountControls", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(requestAccountDeletion).mockResolvedValue({ success: true });
  });

  it("requires typed confirmation before submitting a deletion request", async () => {
    render(<AccountControls />);

    expect(screen.getByRole("link", { name: /export my data/i })).toHaveAttribute("href", "/api/account/export");
    fireEvent.click(screen.getByRole("button", { name: /delete my account/i }));

    const submit = screen.getByRole("button", { name: /submit deletion request/i });
    expect(submit).toBeDisabled();

    fireEvent.change(screen.getByLabelText(/reason/i), {
      target: { value: "I no longer use StormHub." },
    });
    fireEvent.change(screen.getByLabelText(/type delete/i), {
      target: { value: "DELETE" },
    });
    expect(submit).toBeEnabled();
    fireEvent.click(submit);

    await waitFor(() => {
      expect(requestAccountDeletion).toHaveBeenCalledWith("I no longer use StormHub.");
    });
    expect(toast).toHaveBeenCalledWith({
      title: "Deletion request submitted",
      description: "Your account remains available while an authorized administrator reviews the request.",
    });
    expect(refresh).toHaveBeenCalled();
    expect(screen.getByText("Deletion review in progress")).toBeVisible();
  });

  it("shows an existing request without offering another destructive action", () => {
    render(
      <AccountControls
        deletionRequest={{
          status: "pending",
          requested_at: "2026-07-26T05:00:00.000Z",
        }}
      />
    );

    expect(screen.getByText("Deletion review in progress")).toBeVisible();
    expect(screen.queryByRole("button", { name: /delete my account/i })).not.toBeInTheDocument();
  });
});
