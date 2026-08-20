import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { DemoEnvironmentBanner } from "@/components/layout/demo-environment-banner";
import { ContentForm } from "@/components/forms/content-form";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: vi.fn() }),
}));

describe("Elkhorn demo interface", () => {
  it("shows the required fictional-data warning", () => {
    render(<DemoEnvironmentBanner />);
    expect(screen.getByRole("status")).toHaveTextContent("DEMONSTRATION ENVIRONMENT");
    expect(screen.getByRole("status")).toHaveTextContent("not an official Elkhorn Public Schools deployment");
  });

  it("explains mandatory staff review to student club leaders", () => {
    render(
      <ContentForm
        type="announcement"
        clubSlug="demo-engineering-robotics"
        canPublish={false}
        staffReviewRequired
      />
    );
    expect(screen.getByText("Staff approval is required")).toBeVisible();
    expect(screen.getByText(/stays private until an Advisor/i)).toBeVisible();
    expect(screen.queryByText("Publish now")).not.toBeInTheDocument();
  });
});
