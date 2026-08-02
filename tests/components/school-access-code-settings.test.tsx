import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  rotate: vi.fn(),
  save: vi.fn(),
  toast: vi.fn(),
}));

vi.mock("@/lib/actions", () => ({
  rotateSchoolSignupAccessCode: mocks.rotate,
  setSchoolSignupAccessCode: mocks.save,
}));
vi.mock("@/hooks/use-toast", () => ({ toast: mocks.toast }));
vi.mock("@/lib/admin-step-up-shared", () => ({
  beginAdminReauthentication: vi.fn(),
  needsAdminReauthentication: () => false,
}));

import { SchoolAccessCodeSettings } from "@/components/admin/school-access-code-settings";

describe("SchoolAccessCodeSettings", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.save.mockResolvedValue({
      success: true,
      accessCode: "EAGLES-2026",
      rotatedAt: "2026-08-02T12:00:00.000Z",
    });
  });

  it("lets an administrator replace a generated code with a custom code", async () => {
    render(
      <SchoolAccessCodeSettings
        schoolId="school-1"
        schoolName="North High"
        initialCode="SH-ABCD-1234-EF56"
      />,
    );

    fireEvent.change(screen.getByLabelText("Choose a custom code"), {
      target: { value: "eagles-2026" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Save custom code" }));

    await waitFor(() => {
      expect(mocks.save).toHaveBeenCalledWith({
        schoolId: "school-1",
        accessCode: "EAGLES-2026",
      });
    });
    expect(await screen.findAllByText("EAGLES-2026")).not.toHaveLength(0);
  });
});
