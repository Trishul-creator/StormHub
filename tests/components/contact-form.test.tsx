import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ContactForm } from "@/components/forms/contact-form";
import { submitFeedback } from "@/lib/actions";

vi.mock("@/lib/actions", () => ({
  submitFeedback: vi.fn(),
}));
vi.mock("@/components/auth/captcha", () => ({
  Captcha: () => <div data-testid="captcha" />,
}));
vi.mock("@/hooks/use-toast", () => ({
  toast: vi.fn(),
}));

describe("ContactForm school routing", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(submitFeedback).mockResolvedValue({ success: true });
  });

  it("requires an anonymous visitor to choose from the public school list", async () => {
    render(
      <ContactForm
        schools={[
          { id: "school-1", name: "North High" },
          { id: "school-2", name: "South High" },
        ]}
      />
    );

    fireEvent.change(screen.getByLabelText("School"), { target: { value: "school-2" } });
    fireEvent.change(screen.getByLabelText("Message"), {
      target: { value: "I need help with my account." },
    });
    fireEvent.click(screen.getByRole("button", { name: "Send message" }));

    await waitFor(() => {
      expect(submitFeedback).toHaveBeenCalledWith(expect.objectContaining({
        schoolId: "school-2",
        message: "I need help with my account.",
      }));
    });
  });

  it("locks a signed-in user to their assigned school", () => {
    const { container } = render(
      <ContactForm
        schools={[{ id: "school-2", name: "South High" }]}
        assignedSchool={{ id: "school-1", name: "North High" }}
      />
    );

    expect(screen.getByText("North High")).toBeVisible();
    expect(screen.queryByRole("combobox", { name: "School" })).not.toBeInTheDocument();
    expect(container.querySelector('input[name="schoolId"]')).toHaveValue("school-1");
  });
});
