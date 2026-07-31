import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { UserInventoryFilters } from "@/components/admin/user-inventory-filters";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: vi.fn() }),
}));

const roles = ["student", "teacher", "admin", "district_admin", "super_admin"] as const;
const schools = [
  { id: "school-1", name: "North High", slug: "north" },
  { id: "school-2", name: "South High", slug: "south" },
];

describe("UserInventoryFilters", () => {
  it("applies select filters immediately without an Apply filters button", () => {
    const navigate = vi.fn();
    render(
      <UserInventoryFilters
        initialSearch="alex"
        initialRole={null}
        initialSchool="north"
        roles={[...roles]}
        schools={schools}
        schoolLabel="All platform schools"
        showSchool
        onNavigate={navigate}
      />
    );

    expect(screen.queryByRole("button", { name: /apply filters/i })).not.toBeInTheDocument();
    fireEvent.change(screen.getByLabelText("Role"), { target: { value: "teacher" } });

    expect(navigate).toHaveBeenCalledWith(
      "/admin/users?q=alex&role=teacher&school=north"
    );
  });

  it("runs a search immediately when Enter is pressed", () => {
    const navigate = vi.fn();
    render(
      <UserInventoryFilters
        initialSearch=""
        initialRole="student"
        initialSchool={null}
        roles={[...roles]}
        schools={schools}
        schoolLabel="All district schools"
        showSchool
        onNavigate={navigate}
      />
    );

    const search = screen.getByRole("searchbox", { name: /search people/i });
    fireEvent.change(search, { target: { value: "Taylor" } });
    fireEvent.keyDown(search, { key: "Enter" });

    expect(navigate).toHaveBeenCalledWith("/admin/users?q=Taylor&role=student");
  });
});
