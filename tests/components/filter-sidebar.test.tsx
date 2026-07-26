import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { FilterSidebar } from "@/components/layout/filter-sidebar";

vi.mock("next/navigation", () => ({
  useSearchParams: () => new URLSearchParams("q=robot&featured=true"),
}));

describe("FilterSidebar", () => {
  it("clears mutually exclusive filters when a category is selected", () => {
    render(
      <FilterSidebar
        options={[{ label: "STEM", value: "STEM" }]}
        exclusiveParamNames={["featured"]}
      />
    );

    expect(screen.getByRole("link", { name: "STEM" })).toHaveAttribute("href", "?q=robot&filter=STEM");
    expect(screen.getByRole("link", { name: "All" })).toHaveAttribute("href", "?q=robot");
  });
});
