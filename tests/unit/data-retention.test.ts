import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  createAdminClient: vi.fn(),
}));

vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: mocks.createAdminClient,
}));

import { runDataRetention } from "@/lib/data-retention";

describe("automated data retention", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("deletes every expired operational category and records the run", async () => {
    const completedUpdates: Array<Record<string, unknown>> = [];
    const removedTables: string[] = [];
    const admin = {
      from: vi.fn((table: string) => {
        if (table === "data_retention_runs") {
          return {
            insert: vi.fn(() => ({
              select: vi.fn(() => ({
                single: vi.fn().mockResolvedValue({
                  data: { id: "run-1" },
                  error: null,
                }),
              })),
            })),
            update: vi.fn((values: Record<string, unknown>) => {
              completedUpdates.push(values);
              return {
                eq: vi.fn().mockResolvedValue({ error: null }),
              };
            }),
            delete: vi.fn(() => removalQuery(table, removedTables)),
          };
        }
        return {
          delete: vi.fn(() => removalQuery(table, removedTables)),
        };
      }),
    };
    mocks.createAdminClient.mockReturnValue(admin);

    const counts = await runDataRetention();

    expect(Object.values(counts).every((count) => count === 1)).toBe(true);
    expect(removedTables).toEqual(expect.arrayContaining([
      "signup_attempts",
      "request_attempts",
      "email_outbox",
      "notifications",
      "feedback",
      "analytics_events",
      "admin_audit_log",
      "platform_support_sessions",
    ]));
    expect(completedUpdates).toContainEqual(expect.objectContaining({
      status: "completed",
      deleted_counts: counts,
      error_message: null,
    }));
  });
});

function removalQuery(table: string, removedTables: string[]) {
  const query = {
    lt: vi.fn(),
    eq: vi.fn(),
    in: vi.fn(),
    neq: vi.fn(),
    select: vi.fn(),
  };
  query.lt.mockReturnValue(query);
  query.eq.mockReturnValue(query);
  query.in.mockReturnValue(query);
  query.neq.mockReturnValue(query);
  query.select.mockImplementation(async () => {
    removedTables.push(table);
    return { data: [{ id: `${table}-1` }], error: null };
  });
  return query;
}
