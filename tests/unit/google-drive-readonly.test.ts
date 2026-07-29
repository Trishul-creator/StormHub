import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { maybeSingle } = vi.hoisted(() => ({
  maybeSingle: vi.fn(),
}));

vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => ({
    from: () => ({
      select: () => ({
        eq: () => ({ maybeSingle }),
      }),
    }),
  }),
}));

import {
  createReadOnlyGoogleDriveFileResponse,
  encryptGoogleToken,
} from "@/lib/google-drive";

describe("read-only Google Drive support preview", () => {
  beforeEach(() => {
    process.env.GOOGLE_DRIVE_CLIENT_ID = "client-id";
    process.env.GOOGLE_DRIVE_CLIENT_SECRET = "client-secret";
    process.env.GOOGLE_DRIVE_TOKEN_ENCRYPTION_KEY = "b".repeat(64);
    process.env.NEXT_PUBLIC_SITE_URL = "https://stormhubapp.com";
    maybeSingle.mockResolvedValue({
      data: {
        user_id: "owner-1",
        access_token_encrypted: encryptGoogleToken("owner-access-token"),
        token_expires_at: "2099-07-28T12:00:00.000Z",
      },
      error: null,
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.clearAllMocks();
    delete process.env.GOOGLE_DRIVE_CLIENT_ID;
    delete process.env.GOOGLE_DRIVE_CLIENT_SECRET;
    delete process.env.GOOGLE_DRIVE_TOKEN_ENCRYPTION_KEY;
  });

  it("streams a Google Doc as a non-cached PDF without changing sharing permissions", async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({
        id: "file-1",
        name: "Private plan",
        mimeType: "application/vnd.google-apps.document",
      }), {
        status: 200,
        headers: { "content-type": "application/json" },
      }))
      .mockResolvedValueOnce(new Response(new Uint8Array([37, 80, 68, 70]), {
        status: 200,
        headers: { "content-type": "application/pdf" },
      }));
    vi.stubGlobal("fetch", fetchMock);

    const response = await createReadOnlyGoogleDriveFileResponse({
      ownerUserId: "owner-1",
      fileId: "file-1",
    });

    expect(response.headers.get("cache-control")).toBe("private, no-store");
    expect(response.headers.get("content-type")).toBe("application/pdf");
    expect(response.headers.get("content-disposition")).toContain("Private%20plan.pdf");
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(fetchMock.mock.calls.every((call) => call[1]?.method !== "POST")).toBe(true);
  });
});
