import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  DistrictSettings,
  SchoolSettings,
} from "@/components/admin/organization-settings";
import type { District, School } from "@/types/database";

const push = vi.fn();
const refresh = vi.fn();
const replace = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push, refresh, replace }),
}));
vi.mock("@/lib/actions", () => ({
  deleteEmptyDistrict: vi.fn(),
  deleteEmptySchool: vi.fn(),
  updateDistrictDetails: vi.fn(),
  updateSchoolDetails: vi.fn(),
}));
vi.mock("@/hooks/use-toast", () => ({
  toast: vi.fn(),
}));
vi.mock("@/components/auth/admin-reauthentication-dialog", () => ({
  AdminReauthenticationDialog: () => null,
}));

const district: District = {
  id: "district-1",
  name: "Example Public Schools",
  slug: "example-public-schools",
  city: "Example",
  state: "NE",
  website_url: "https://district.example",
  is_active: true,
};

const school: School = {
  id: "school-1",
  district_id: district.id,
  name: "Example High",
  slug: "example-high",
  is_active: true,
  is_public: true,
};

describe("organization settings", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("gives platform admins an obvious permanent-delete option for an empty district", () => {
    render(
      <DistrictSettings
        district={district}
        actorRole="super_admin"
        actorEmail="platform@example.edu"
        schoolCount={0}
        assignedAccountCount={0}
      />
    );

    fireEvent.click(screen.getByRole("button", { name: "District settings" }));
    expect(screen.getByRole("dialog", { name: "District settings" })).toBeVisible();
    expect(screen.getByRole("button", { name: "Permanently delete district" })).toBeVisible();
  });

  it("routes a populated district through the audited offboarding workflow", () => {
    render(
      <DistrictSettings
        district={district}
        actorRole="super_admin"
        actorEmail="platform@example.edu"
        schoolCount={2}
        assignedAccountCount={14}
      />
    );

    fireEvent.click(screen.getByRole("button", { name: "District settings" }));
    expect(screen.queryByRole("button", { name: "Permanently delete district" }))
      .not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Open Tenant offboarding" }));
    expect(push).toHaveBeenCalledWith("/admin/offboarding");
  });

  it("keeps permanent school deletion out of the school-admin scope", () => {
    render(
      <SchoolSettings
        school={school}
        actorRole="admin"
        actorEmail="admin@example.edu"
      />
    );

    fireEvent.click(screen.getByRole("button", { name: "School settings" }));
    expect(screen.getByRole("dialog", { name: "School settings" })).toBeVisible();
    expect(screen.queryByRole("button", { name: /Permanently delete/i }))
      .not.toBeInTheDocument();
  });
});
