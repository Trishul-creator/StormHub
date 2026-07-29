import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { ClubCreationOptions } from "@/components/manage/club-creation-options";

describe("ClubCreationOptions", () => {
  it("offers both the starter catalog and a school-scoped custom club", () => {
    render(
      <ClubCreationOptions
        customClubHref="/manage/clubs/new?school=school1"
        customClubLabel="Create a custom club"
      />
    );

    expect(screen.getByRole("link", { name: /browse starter clubs/i })).toHaveAttribute(
      "href",
      "#starter-club-catalog"
    );
    expect(screen.getByRole("link", { name: /create a custom club/i })).toHaveAttribute(
      "href",
      "/manage/clubs/new?school=school1"
    );
  });
});
