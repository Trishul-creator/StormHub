import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  TenantOffboardingWorkflow,
  type TenantOffboardingRequestView,
} from "@/components/admin/tenant-offboarding-workflow";
import {
  cancelTenantOffboardingRequest,
  reviewTenantOffboardingRequest,
  submitTenantOffboardingRequest,
} from "@/lib/actions";

const refresh = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh }),
}));

vi.mock("@/lib/actions", () => ({
  submitTenantOffboardingRequest: vi.fn(),
  reviewTenantOffboardingRequest: vi.fn(),
  cancelTenantOffboardingRequest: vi.fn(),
}));

const baseRequest: TenantOffboardingRequestView = {
  id: "request-1",
  scopeType: "school",
  scopeLabel: "School · Example High",
  status: "export_ready",
  requestReason: "The school contract ended and its records must be exported and deleted.",
  requestedAt: "2026-07-30T12:00:00.000Z",
  requestedByLabel: "School Administrator",
  requestedByUserId: "admin-1",
  reviewerNotes: null,
  exportReference: "vault/export-1",
  scheduledPurgeAt: null,
  completionReference: null,
  allowedTransitions: ["rejected"],
  canCancel: false,
};

describe("TenantOffboardingWorkflow", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(submitTenantOffboardingRequest).mockResolvedValue({
      success: true,
      requestId: "request-2",
    });
    vi.mocked(reviewTenantOffboardingRequest).mockResolvedValue({ success: true });
    vi.mocked(cancelTenantOffboardingRequest).mockResolvedValue({ success: true });
  });

  it("fails closed when the database workflow has not been deployed", () => {
    render(
      <TenantOffboardingWorkflow
        scopeOptions={[]}
        requests={[]}
        schemaAvailable={false}
      />
    );

    expect(screen.getByText("Tenant offboarding is not available yet")).toBeVisible();
    expect(screen.queryByRole("button", { name: "Submit protected request" })).not.toBeInTheDocument();
  });

  it("submits a scoped request while clearly preserving tenant data", async () => {
    render(
      <TenantOffboardingWorkflow
        scopeOptions={[
          { scopeType: "school", scopeId: "school-1", label: "School · Example High" },
        ]}
        requests={[]}
        schemaAvailable
      />
    );

    expect(screen.getByText(/never deletes, deactivates, or hides tenant data/i)).toBeVisible();
    fireEvent.change(screen.getByLabelText("Instruction and reason"), {
      target: {
        value: "The contract ends after the protected export and written district approval.",
      },
    });
    fireEvent.click(screen.getByRole("button", { name: "Submit protected request" }));

    await waitFor(() =>
      expect(submitTenantOffboardingRequest).toHaveBeenCalledWith({
        scopeType: "school",
        scopeId: "school-1",
        reason: "The contract ends after the protected export and written district approval.",
      })
    );
    expect(refresh).toHaveBeenCalled();
  });

  it("keeps district review limited to preliminary school workflow steps", () => {
    render(
      <TenantOffboardingWorkflow
        scopeOptions={[]}
        requests={[baseRequest]}
        schemaAvailable
      />
    );

    const card = screen.getByText("School · Example High").closest("div.rounded-xl");
    expect(card).not.toBeNull();
    const statusSelect = screen.getByLabelText("Next status");
    expect(within(statusSelect).getByRole("option", { name: "rejected" })).toBeInTheDocument();
    expect(within(statusSelect).queryByRole("option", { name: "approved" })).not.toBeInTheDocument();
  });

  it("shows platform scheduling and recoverable cancellation controls after approval", () => {
    render(
      <TenantOffboardingWorkflow
        scopeOptions={[]}
        requests={[
          {
            ...baseRequest,
            status: "approved",
            allowedTransitions: ["scheduled"],
            canCancel: true,
          },
        ]}
        schemaAvailable
      />
    );

    expect(screen.getByRole("option", { name: "scheduled" })).toBeInTheDocument();
    expect(screen.getByLabelText("Deletion date and time")).toBeVisible();
    expect(screen.getByRole("button", { name: "Schedule deletion" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Cancel request" })).toBeVisible();
    expect(screen.getByText(/does not perform an automatic physical purge/i)).toBeVisible();
  });
});
