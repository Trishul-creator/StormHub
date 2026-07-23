import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { DigestPreview } from "@/components/manage/digest-preview";
import type { Opportunity } from "@/types/database";

const opportunity: Opportunity = {
  id: "opportunity-1",
  school_id: "school-1",
  title: "Science Fair",
  slug: "science-fair",
  event_date: "2026-08-15T12:00:00.000Z",
  deadline: "2026-08-01T12:00:00.000Z",
  status: "approved",
  visibility: "public",
};

describe("DigestPreview", () => {
  it("shows both the opportunity date and deadline", () => {
    render(
      <DigestPreview
        opportunities={[opportunity]}
        events={[]}
        clubs={[]}
        announcements={[]}
        schoolName="Storm High"
      />
    );

    expect(screen.getByText(/Science Fair \(Date: Aug 15, 2026 · Deadline: Aug 1, 2026\)/)).toBeInTheDocument();
  });
});
