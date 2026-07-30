import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  createAdminClient: vi.fn(),
  sendEmailOutboxItem: vi.fn(),
}));

vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: mocks.createAdminClient,
}));

vi.mock("@/lib/supabase/mode", () => ({
  isDemoMode: () => false,
}));

vi.mock("@/lib/email", () => ({
  isEmailDeliveryEnabled: () => true,
  isEmailOutboxEnabled: () => true,
  sendEmailOutboxItem: mocks.sendEmailOutboxItem,
}));

import { createEmailOutboxItem, createNotification } from "@/lib/notifications";

describe("notification recipient lifecycle", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it.each(["suspended", "deactivated"] as const)(
    "does not notify or email a %s account",
    async (accountStatus) => {
      const insertedTables: string[] = [];
      mocks.createAdminClient.mockReturnValue(
        notificationAdmin({
          accountStatus,
          insertedTables,
        })
      );

      await createNotification({
        recipientUserId: "inactive-user",
        type: "system_message",
        importance: "urgent",
        title: "Account update",
        message: "This message must not be delivered.",
        sendEmail: true,
      });

      expect(insertedTables).toEqual([]);
      expect(mocks.sendEmailOutboxItem).not.toHaveBeenCalled();
    }
  );

  it("still creates an in-app notification for an active account", async () => {
    const insertedTables: string[] = [];
    mocks.createAdminClient.mockReturnValue(
      notificationAdmin({
        accountStatus: "active",
        insertedTables,
      })
    );

    await createNotification({
      recipientUserId: "active-user",
      type: "system_message",
      importance: "normal",
      title: "Welcome",
      message: "Your account is ready.",
    });

    expect(insertedTables).toEqual(["notifications"]);
  });

  it("returns the queued outbox id and stores a stable dedupe key", async () => {
    const insert = vi.fn(() => ({
      select: vi.fn(() => ({
        single: vi.fn().mockResolvedValue({
          data: {
            id: "outbox-1",
            recipient_email: "student@example.test",
            subject: "Response",
            body: "Resolved",
          },
          error: null,
        }),
      })),
    }));
    mocks.createAdminClient.mockReturnValue({
      from: vi.fn(() => ({ insert })),
    });

    await expect(createEmailOutboxItem({
      recipientEmail: "student@example.test",
      subject: "Response",
      body: "Resolved",
      type: "feedback_response",
      dedupeKey: "feedback-response:feedback-1:digest",
    })).resolves.toBe("outbox-1");

    expect(insert).toHaveBeenCalledWith(expect.objectContaining({
      dedupe_key: "feedback-response:feedback-1:digest",
    }));
    expect(mocks.sendEmailOutboxItem).toHaveBeenCalledWith(expect.objectContaining({
      id: "outbox-1",
    }));
  });

  it("returns the existing outbox id after a deduplicated retry", async () => {
    const maybeSingle = vi.fn().mockResolvedValue({
      data: { id: "outbox-existing" },
      error: null,
    });
    mocks.createAdminClient.mockReturnValue({
      from: vi.fn(() => ({
        insert: vi.fn(() => ({
          select: vi.fn(() => ({
            single: vi.fn().mockResolvedValue({
              data: null,
              error: { code: "23505", message: "duplicate key" },
            }),
          })),
        })),
        select: vi.fn(() => ({
          eq: vi.fn(() => ({ maybeSingle })),
        })),
      })),
    });

    await expect(createEmailOutboxItem({
      recipientEmail: "student@example.test",
      subject: "Response",
      body: "Resolved",
      type: "feedback_response",
      dedupeKey: "feedback-response:feedback-1:digest",
    })).resolves.toBe("outbox-existing");
    expect(mocks.sendEmailOutboxItem).not.toHaveBeenCalled();
  });
});

function notificationAdmin({
  accountStatus,
  insertedTables,
}: {
  accountStatus: "active" | "suspended" | "deactivated";
  insertedTables: string[];
}) {
  return {
    from: vi.fn((table: string) => {
      if (table === "profiles") {
        return {
          select: vi.fn(() => ({
            eq: vi.fn(() => ({
              maybeSingle: vi.fn().mockResolvedValue({
                data: {
                  email: "recipient@example.test",
                  role: "student",
                  account_status: accountStatus,
                },
                error: null,
              }),
            })),
          })),
        };
      }
      if (table === "notification_preferences") {
        return {
          select: vi.fn(() => ({
            eq: vi.fn(() => ({
              maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
            })),
          })),
        };
      }
      return {
        insert: vi.fn(async () => {
          insertedTables.push(table);
          return { error: null };
        }),
      };
    }),
  };
}
