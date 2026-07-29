import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { StatisticsScopeSelector } from "@/components/admin/statistics-scope-selector";

const replace = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace }),
}));

const schools = [
  { id: "school-1", name: "North High", slug: "north" },
  { id: "school-2", name: "South High", slug: "south" },
];

describe("statistics scope selector", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("applies a school immediately without a separate submit button", async () => {
    render(<StatisticsScopeSelector schools={schools} activeSlug={null} />);

    fireEvent.change(screen.getByLabelText("View scope"), {
      target: { value: "south" },
    });

    await waitFor(() => {
      expect(replace).toHaveBeenCalledWith(
        "/admin/statistics?school=south",
        { scroll: false }
      );
    });
    expect(screen.queryByRole("button", { name: "Apply" })).not.toBeInTheDocument();
  });

  it("returns to platform statistics when All schools is selected", async () => {
    render(<StatisticsScopeSelector schools={schools} activeSlug="north" />);

    fireEvent.change(screen.getByLabelText("View scope"), {
      target: { value: "" },
    });

    await waitFor(() => {
      expect(replace).toHaveBeenCalledWith("/admin/statistics", { scroll: false });
    });
  });
});
