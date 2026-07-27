import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { DraftClubCatalog } from "@/components/manage/draft-club-catalog";

const clubs = [
  {
    id: "club-1",
    name: "Robotics Club",
    slug: "school-robotics-club",
    category: "STEM",
    short_description: "Build and program robots.",
    tags: ["engineering"],
  },
  {
    id: "club-2",
    name: "Art Club",
    slug: "school-art-club",
    category: "Arts",
    short_description: "Create visual art.",
    tags: ["creative"],
  },
  {
    id: "club-3",
    name: "Key Club",
    slug: "school-key-club",
    category: "Service",
    short_description: "Volunteer in the community.",
    tags: ["leadership"],
  },
];

describe("DraftClubCatalog", () => {
  it("searches and filters a large school catalog", () => {
    render(<DraftClubCatalog clubs={clubs} mode="admin" />);

    expect(screen.getByText("3 templates")).toBeVisible();
    fireEvent.change(screen.getByLabelText("Search draft clubs"), { target: { value: "engineering" } });
    expect(screen.getByRole("heading", { name: "Robotics Club" })).toBeVisible();
    expect(screen.queryByRole("heading", { name: "Art Club" })).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Clear" }));
    fireEvent.change(screen.getByLabelText("Filter draft clubs by category"), { target: { value: "Arts" } });
    expect(screen.getByRole("heading", { name: "Art Club" })).toBeVisible();
    expect(screen.queryByRole("heading", { name: "Key Club" })).not.toBeInTheDocument();
  });

  it("keeps publication controls away from teachers", () => {
    render(<DraftClubCatalog clubs={[clubs[0]]} mode="teacher" />);

    expect(screen.getByRole("link", { name: "Awaiting admin review" })).toHaveAttribute(
      "href",
      "/manage/clubs/school-robotics-club/edit"
    );
    expect(screen.queryByRole("link", { name: /publish/i })).not.toBeInTheDocument();
  });
});
