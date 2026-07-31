import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { SchoolFilter } from "@/components/layout/school-filter";

const replace = vi.fn();

vi.mock("next/navigation", () => ({
  usePathname: () => "/calendar",
  useRouter: () => ({ replace }),
  useSearchParams: () => new URLSearchParams("q=robotics&type=meeting"),
}));

describe("SchoolFilter", () => {
  beforeEach(() => replace.mockReset());

  it("preserves other filters when changing schools", () => {
    render(
      <SchoolFilter
        activeSlug="north"
        schools={[
          { slug: "north", name: "North High" },
          { slug: "south", name: "South High" },
        ]}
      />
    );

    fireEvent.change(screen.getByLabelText("School"), { target: { value: "south" } });
    expect(replace).toHaveBeenCalledWith(
      "/calendar?q=robotics&type=meeting&school=south",
      { scroll: false }
    );
  });

  it("does not add a redundant selector when only one school is available", () => {
    render(<SchoolFilter activeSlug="north" schools={[{ slug: "north", name: "North High" }]} />);
    expect(screen.queryByLabelText("School")).not.toBeInTheDocument();
  });
});
