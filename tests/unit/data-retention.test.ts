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
    let pendingIntentRead = 0;
    const admin = {
      rpc: vi.fn((name: string, args?: Record<string, unknown>) => {
        if (name === "begin_data_retention_run") {
          return Promise.resolve({ data: "run-1", error: null });
        }
        if (name === "has_any_active_legal_hold") {
          return Promise.resolve({ data: false, error: null });
        }
        if (name === "delete_retention_batch") {
          removedTables.push(String(args?.target_table));
          return Promise.resolve({ data: 1, error: null });
        }
        return Promise.resolve({ data: null, error: null });
      }),
      from: vi.fn((table: string) => {
        if (table === "coursework_upload_intents") {
          return {
            select: vi.fn(() => uploadIntentSelectionQuery({
              pending: pendingIntentRead++ === 0
                ? [{ id: "pending-intent", storage_path: "assignment/pending.pdf" }]
                : [],
              terminal: [{ id: "rejected-intent", storage_path: "assignment/rejected.pdf" }],
            })),
            update: vi.fn(() => uploadIntentUpdateQuery()),
            delete: vi.fn(() => removalQuery(table, removedTables)),
          };
        }
        if (table === "data_retention_runs") {
          return {
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
      storage: {
        from: vi.fn(() => ({
          remove: vi.fn(async (paths: string[]) => ({
            data: paths.map((path) => ({ name: path })),
            error: null,
          })),
        })),
      },
    };
    mocks.createAdminClient.mockReturnValue(admin);

    const counts = await runDataRetention();

    expect(counts.coursework_upload_intents).toBe(2);
    expect(counts.coursework_upload_objects).toBe(1);
    expect(Object.entries(counts)
      .filter(([key]) => !["coursework_upload_intents", "coursework_upload_objects"].includes(key))
      .every(([, count]) => count === 1)).toBe(true);
    expect(removedTables).toEqual(expect.arrayContaining([
      "signup_attempts",
      "request_attempts",
      "email_outbox",
      "notifications",
      "feedback",
      "analytics_events",
      "admin_audit_log",
      "platform_support_sessions",
      "platform_support_access_log",
      "account_deletion_executions",
    ]));
    expect(completedUpdates).toContainEqual(expect.objectContaining({
      status: "completed",
      deleted_counts: counts,
      error_message: null,
    }));
    expect(admin.rpc).toHaveBeenCalledWith("begin_data_retention_run");
  });

  it("does not duplicate deletion work while another retention worker holds the lease", async () => {
    const admin = {
      rpc: vi.fn().mockResolvedValue({ data: null, error: null }),
      from: vi.fn(),
    };
    mocks.createAdminClient.mockReturnValue(admin);

    const counts = await runDataRetention();

    expect(Object.values(counts).every((count) => count === 0)).toBe(true);
    expect(admin.from).not.toHaveBeenCalled();
  });

  it("fails closed and records no deletions while a legal hold is active", async () => {
    const completedUpdates: Array<Record<string, unknown>> = [];
    const admin = {
      rpc: vi.fn((name: string) => Promise.resolve({
        data: name === "begin_data_retention_run" ? "run-held" : true,
        error: null,
      })),
      from: vi.fn((table: string) => {
        if (table !== "data_retention_runs") {
          throw new Error(`Unexpected deletion from ${table}`);
        }
        return {
          update: vi.fn((values: Record<string, unknown>) => {
            completedUpdates.push(values);
            return { eq: vi.fn().mockResolvedValue({ error: null }) };
          }),
        };
      }),
    };
    mocks.createAdminClient.mockReturnValue(admin);

    const counts = await runDataRetention();

    expect(Object.values(counts).every((count) => count === 0)).toBe(true);
    expect(completedUpdates).toContainEqual(expect.objectContaining({
      status: "completed",
      skipped_reason: expect.stringContaining("legal hold"),
    }));
  });
});

function removalQuery(table: string, removedTables: string[]) {
  const query = {
    lt: vi.fn(),
    eq: vi.fn(),
    in: vi.fn(),
    neq: vi.fn(),
    not: vi.fn(),
    select: vi.fn(),
  };
  query.lt.mockReturnValue(query);
  query.eq.mockReturnValue(query);
  query.in.mockReturnValue(query);
  query.neq.mockReturnValue(query);
  query.not.mockReturnValue(query);
  query.select.mockImplementation(async () => {
    removedTables.push(table);
    return { data: [{ id: `${table}-1` }], error: null };
  });
  return query;
}

function uploadIntentSelectionQuery(input: {
  pending: Array<{ id: string; storage_path: string }>;
  terminal: Array<{ id: string; storage_path: string }>;
}) {
  let status: "pending" | "terminal" = "pending";
  const query = {
    eq: vi.fn((column: string, value: string) => {
      if (column === "status" && value === "pending") status = "pending";
      return query;
    }),
    in: vi.fn((column: string) => {
      if (column === "status") status = "terminal";
      return query;
    }),
    lt: vi.fn(() => query),
    order: vi.fn(() => query),
    limit: vi.fn(async () => ({ data: input.pending, error: null })),
    range: vi.fn(async () => ({
      data: status === "terminal" ? input.terminal : input.pending,
      error: null,
    })),
  };
  return query;
}

function uploadIntentUpdateQuery() {
  const query = {
    in: vi.fn(() => query),
    eq: vi.fn().mockResolvedValue({ error: null }),
  };
  return query;
}
