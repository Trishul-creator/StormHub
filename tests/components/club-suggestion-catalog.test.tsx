import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  request: vi.fn(),
  toast: vi.fn(),
}));

vi.mock("@/lib/actions", () => ({ requestStarterClub: mocks.request }));
vi.mock("@/hooks/use-toast", () => ({ toast: mocks.toast }));

import { ClubSuggestionCatalog } from "@/components/clubs/club-suggestion-catalog";

describe("ClubSuggestionCatalog", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.request.mockResolvedValue({ success: true });
  });

  it("lets a student suggest a starter once and marks it pending", async () => {
    render(<ClubSuggestionCatalog clubs={[{
      id: "club-1",
      name: "Robotics Club",
      slug: "storm-high-robotics-club",
      category: "STEM",
      short_description: "Build and program robots.",
      tags: ["engineering"],
      already_requested: false,
    }]} />);

    fireEvent.click(screen.getByRole("button", { name: "Suggest this club" }));
    await waitFor(() => expect(mocks.request).toHaveBeenCalledWith("club-1"));
    expect(await screen.findByRole("button", { name: "Suggested" })).toBeDisabled();
    expect(mocks.toast).toHaveBeenCalledWith(expect.objectContaining({ title: "Club suggested" }));
  });

  it("keeps an existing pending suggestion disabled", () => {
    render(<ClubSuggestionCatalog clubs={[{
      id: "club-1",
      name: "Robotics Club",
      slug: "storm-high-robotics-club",
      category: "STEM",
      already_requested: true,
    }]} />);
    expect(screen.getByRole("button", { name: "Suggested" })).toBeDisabled();
  });
});
