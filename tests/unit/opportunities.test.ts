import { describe, expect, it } from "vitest";
import { isOpportunityCurrent } from "@/lib/utils";

const now = new Date("2026-08-02T12:00:00.000Z");

describe("isOpportunityCurrent", () => {
  it("keeps an upcoming event visible after its signup deadline", () => {
    expect(isOpportunityCurrent({
      deadline: "2026-08-01T12:00:00.000Z",
      event_date: "2026-08-05T12:00:00.000Z",
    }, now)).toBe(true);
  });

  it("hides an opportunity once its event date has passed", () => {
    expect(isOpportunityCurrent({
      deadline: "2026-08-05T12:00:00.000Z",
      event_date: "2026-08-01T12:00:00.000Z",
    }, now)).toBe(false);
  });

  it("uses the deadline when no event date exists", () => {
    expect(isOpportunityCurrent({ deadline: "2026-08-01T12:00:00.000Z" }, now)).toBe(false);
    expect(isOpportunityCurrent({ deadline: "2026-08-03T12:00:00.000Z" }, now)).toBe(true);
  });

  it("keeps undated and malformed legacy opportunities visible", () => {
    expect(isOpportunityCurrent({}, now)).toBe(true);
    expect(isOpportunityCurrent({ event_date: "not-a-date" }, now)).toBe(true);
  });
});
