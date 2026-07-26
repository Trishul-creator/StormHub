import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { BookmarkButton } from "@/components/opportunities/bookmark-button";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: vi.fn() }),
}));

describe("BookmarkButton", () => {
  it("names the signed-out icon link for assistive technology", () => {
    render(
      <BookmarkButton
        opportunityId="opportunity-1"
        isLoggedIn={false}
        size="icon"
      />
    );

    expect(screen.getByRole("link", { name: "Sign in to save opportunity" })).toHaveAttribute(
      "href",
      "/auth/sign-in?redirect=/opportunities"
    );
  });
});
