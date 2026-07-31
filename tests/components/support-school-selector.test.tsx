import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { SupportSchoolSelector } from "@/components/admin/support-school-selector";

const replace = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace }),
}));

describe("SupportSchoolSelector", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("opens a scoped inbox immediately when an administrator chooses a school", () => {
    render(
      <SupportSchoolSelector
        schools={[
          { id: "school-1", name: "Example High", slug: "example-high" },
          { id: "school-2", name: "North High", slug: "north-high" },
        ]}
      />
    );

    fireEvent.change(screen.getByRole("combobox", { name: "School inbox" }), {
      target: { value: "north-high" },
    });

    expect(replace).toHaveBeenCalledWith(
      "/admin/feedback?school=north-high",
      { scroll: false }
    );
  });
});
