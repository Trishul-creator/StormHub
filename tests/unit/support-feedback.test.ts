import { describe, expect, it } from "vitest";
import { feedbackResponseDedupeKey } from "@/lib/support-feedback";

describe("support feedback reply deduplication", () => {
  it("uses a stable key for retries of the same response", () => {
    expect(feedbackResponseDedupeKey("feedback-1", "  We fixed it.  "))
      .toBe(feedbackResponseDedupeKey("feedback-1", "We fixed it."));
  });

  it("does not collapse different feedback or response content", () => {
    const first = feedbackResponseDedupeKey("feedback-1", "We fixed it.");
    expect(feedbackResponseDedupeKey("feedback-2", "We fixed it.")).not.toBe(first);
    expect(feedbackResponseDedupeKey("feedback-1", "Please retry.")).not.toBe(first);
  });
});
