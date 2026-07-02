import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { ClubCard } from "@/components/clubs/club-card";
import type { Club } from "@/types/database";

vi.mock("@/components/clubs/join-club-button", () => ({
  JoinClubButton: ({ canManage, isMember, joinLabel }: { canManage?: boolean; isMember?: boolean; joinLabel?: string }) => (
    <button>{canManage ? "Manage Club" : isMember ? "Member page" : joinLabel}</button>
  ),
}));

const club: Club = {
  id: "club-1",
  school_id: "school-1",
  name: "Science Bowl",
  slug: "science-bowl",
  short_description: "Science competition club",
  long_description: null,
  category: "STEM",
  tags: ["science", "competition"],
  meeting_time: null,
  meeting_location: null,
  sponsor_name: null,
  sponsor_email: null,
  join_instructions: null,
  is_active: true,
  is_featured: true,
  is_listed: true,
  status: "interest_open",
  visibility: "public",
  member_count: 4,
  created_at: "2026-01-01T00:00:00.000Z",
  updated_at: "2026-01-01T00:00:00.000Z",
};

describe("ClubCard", () => {
  it("renders school-scoped links and featured/status content", () => {
    render(<ClubCard club={club} schoolSlug="elkhorn-north" isLoggedIn canJoin />);
    expect(screen.getByRole("link", { name: "Science Bowl" })).toHaveAttribute("href", "/s/elkhorn-north/clubs/science-bowl");
    expect(screen.getByText("Featured")).toBeInTheDocument();
    expect(screen.getByText("4 members")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Join / Get Updates" })).toBeInTheDocument();
  });

  it("shows a management action instead of join action for managers", () => {
    render(<ClubCard club={{ ...club, is_featured: false }} canManage />);
    expect(screen.getByRole("button", { name: "Manage Club" })).toBeInTheDocument();
  });
});
