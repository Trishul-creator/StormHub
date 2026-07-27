import { describe, expect, it } from "vitest";
import {
  CLUB_ROLE_DEFINITIONS,
  clubRoleLabel,
  clubRoleRank,
} from "@/lib/club-roles";

describe("club role model", () => {
  it("maps legacy stored membership values to the canonical product labels", () => {
    expect(clubRoleLabel("sponsor")).toBe("Advisor");
    expect(clubRoleLabel("president")).toBe("President");
    expect(clubRoleLabel("officer")).toBe("Vice President");
    expect(clubRoleLabel("member")).toBe("Member");
  });

  it("keeps all student roles represented below the adult Advisor", () => {
    expect(CLUB_ROLE_DEFINITIONS.map((role) => role.label)).toEqual([
      "Advisor",
      "President",
      "Vice President",
      "Member",
    ]);
    expect(clubRoleRank("member")).toBeLessThan(clubRoleRank("officer"));
    expect(clubRoleRank("officer")).toBeLessThan(clubRoleRank("president"));
    expect(clubRoleRank("president")).toBeLessThan(clubRoleRank("sponsor"));
  });
});
