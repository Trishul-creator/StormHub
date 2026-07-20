import { describe, expect, it } from "vitest";
import {
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

  it("lets platform admins select an explicit school and hides private schools publicly", () => {
    const schools = [
      school("school-1", "north"),
      { ...school("school-2", "south"), is_public: false },
    ];

    expect(getFilterableSchools(schools, null).map((item) => item.slug)).toEqual(["north"]);
    const platformSchools = getFilterableSchools(schools, { id: "admin", role: "super_admin" });
    expect(selectSchoolFilter(platformSchools, "south")?.id).toBe("school-2");
  });
});

function school(id: string, slug: string): School {
  return { id, slug, name: slug, is_active: true, is_public: true };
}
