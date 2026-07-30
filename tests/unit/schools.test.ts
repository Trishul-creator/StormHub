import { describe, expect, it } from "vitest";
import {
  canProfileViewSchool,
  getAdminScopeSchools,
  getDefaultSchoolSlug,
  getFilterableSchools,
  getSchoolManageUrl,
  getSchoolPublicUrl,
  getSchoolWorkspaceUrl,
  selectSchoolFilter,
} from "@/lib/schools";
import type { Profile, School } from "@/types/database";

describe("school route helpers", () => {
  it("uses the configured default slug or stable fallback", () => {
    expect(getDefaultSchoolSlug()).toBe(process.env.NEXT_PUBLIC_DEFAULT_SCHOOL_SLUG?.trim() || "elkhorn-south");
  });

  it("builds school workspace routes from explicit slugs", () => {
    expect(getSchoolWorkspaceUrl({ slug: "elkhorn-north" })).toBe("/s/elkhorn-north");
    expect(getSchoolPublicUrl({ slug: "elkhorn-south" })).toBe("/s/elkhorn-south");
  });

  it("builds manage routes from explicit slugs", () => {
    expect(getSchoolManageUrl({ slug: "elkhorn-north" })).toBe("/admin/schools/elkhorn-north");
  });

  it("does not silently rewrite an explicit school slug to the default school", () => {
    const selectedSchool = { slug: "elkhorn-north" };
    expect(getSchoolWorkspaceUrl(selectedSchool)).not.toBe("/s/elkhorn-south");
    expect(getSchoolManageUrl(selectedSchool)).not.toBe("/admin/schools/elkhorn-south");
  });

  it("limits signed-in school users to their assigned school", () => {
    const schools = [school("school-1", "north"), school("school-2", "south")];
    const profile = { id: "user-1", school_id: "school-2", role: "student" } satisfies Profile;

    expect(getFilterableSchools(schools, profile).map((item) => item.slug)).toEqual(["south"]);
  });

  it("rejects cross-school viewers while preserving district and platform scopes", () => {
    const north = { ...school("school-1", "north"), district_id: "district-1" };
    const south = { ...school("school-2", "south"), district_id: "district-2" };

    expect(canProfileViewSchool(
      { id: "student", role: "student", school_id: north.id },
      north
    )).toBe(true);
    expect(canProfileViewSchool(
      { id: "student", role: "student", school_id: north.id },
      south
    )).toBe(false);
    expect(canProfileViewSchool(
      { id: "district", role: "district_admin", district_id: "district-1" },
      north
    )).toBe(true);
    expect(canProfileViewSchool(
      { id: "district", role: "district_admin", district_id: "district-1" },
      south
    )).toBe(false);
    expect(canProfileViewSchool({ id: "platform", role: "super_admin" }, south)).toBe(true);
  });

  it("lets platform admins select an explicit school and hides private schools publicly", () => {
    const schools = [
      school("school-1", "north"),
      { ...school("school-2", "south"), is_public: false },
    ];

    expect(getFilterableSchools(schools, null).map((item) => item.slug)).toEqual(["north"]);
    const platformSchools = getFilterableSchools(schools, { id: "admin", role: "super_admin" });
    expect(selectSchoolFilter(platformSchools, "south")?.id).toBe("school-2");
  });

  it("keeps inactive and private schools in authorized administrative selectors", () => {
    const schools = [
      { ...school("school-1", "north"), district_id: "district-1", is_active: false },
      { ...school("school-2", "south"), district_id: "district-1", is_public: false },
      { ...school("school-3", "west"), district_id: "district-2" },
    ];

    expect(getAdminScopeSchools(
      schools,
      { id: "district", role: "district_admin", district_id: "district-1" }
    ).map((item) => item.slug)).toEqual(["north", "south"]);
    expect(getAdminScopeSchools(
      schools,
      { id: "platform", role: "super_admin" }
    ).map((item) => item.slug)).toEqual(["north", "south", "west"]);
    expect(getAdminScopeSchools(
      schools,
      { id: "school-admin", role: "admin", school_id: "school-2" }
    ).map((item) => item.slug)).toEqual(["south"]);
  });
});

function school(id: string, slug: string): School {
  return { id, slug, name: slug, is_active: true, is_public: true };
}
