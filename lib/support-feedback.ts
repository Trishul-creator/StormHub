import { createHash } from "node:crypto";

export function feedbackResponseDedupeKey(feedbackId: string, response: string): string {
  const responseDigest = createHash("sha256")
    .update(response.trim())
    .digest("hex")
    .slice(0, 32);
  return `feedback-response:${feedbackId}:${responseDigest}`;
}
