import { describe, expect, it } from "vitest";
import {
  getDefaultSchoolSlug,
  getSchoolManageUrl,
  getSchoolPublicUrl,
  getSchoolWorkspaceUrl,
} from "@/lib/schools";

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
});
