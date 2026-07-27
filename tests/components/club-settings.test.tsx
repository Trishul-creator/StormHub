import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { ClubSettingsForm } from "@/components/manage/club-settings-form";
import type { Club, Profile } from "@/types/database";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
}));

vi.mock("@/lib/actions", () => ({
  updateClubSettings: vi.fn(),
}));

vi.mock("@/hooks/use-toast", () => ({
  toast: vi.fn(),
}));

const club: Club = {
  id: "club-1",
  school_id: "school-1",
  name: "Robotics Club",
  slug: "robotics-club",
  short_description: "Build robots",
  long_description: null,
  category: "STEM",
  tags: [],
  meeting_time: null,
  meeting_location: null,
  sponsor_name: "Teacher Sponsor",
  sponsor_email: "teacher@school.edu",
  join_instructions: null,
  is_active: false,
  is_featured: false,
  is_listed: false,
  status: "draft",
  visibility: "unlisted",
  created_at: "2026-07-26T00:00:00.000Z",
  updated_at: "2026-07-26T00:00:00.000Z",
};

const teacher: Profile = {
  id: "teacher-1",
  school_id: "school-1",
  role: "teacher",
  email: "teacher@school.edu",
  full_name: "Teacher Sponsor",
};

describe("club publication settings", () => {
  it("keeps publication, featuring, and sponsor assignment hidden from teacher sponsors", () => {
    render(<ClubSettingsForm club={club} teachers={[teacher]} canManagePublication={false} />);

    expect(screen.queryByLabelText("Status")).not.toBeInTheDocument();
    expect(screen.queryByLabelText("Featured")).not.toBeInTheDocument();
    expect(screen.queryByLabelText("Teacher sponsor")).not.toBeInTheDocument();
    expect(screen.getByText(/school administrator must approve publication/i)).toBeVisible();
  });

  it("shows scoped publication controls to administrators", () => {
    render(<ClubSettingsForm club={club} teachers={[teacher]} canManagePublication />);

    expect(screen.getByLabelText("Status")).toBeVisible();
    expect(screen.getByLabelText("Featured")).toBeVisible();
    expect(screen.getByLabelText("Club Advisor")).toBeVisible();
  });
});
