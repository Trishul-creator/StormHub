import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  createAdminClient: vi.fn(),
  createClient: vi.fn(),
  getCurrentProfile: vi.fn(),
  revalidatePath: vi.fn(),
  disconnectGoogleDrive: vi.fn(),
  createNotification: vi.fn(),
  requireRecentAdminAuthentication: vi.fn(),
}));

vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: mocks.createAdminClient,
}));
vi.mock("@/lib/supabase/server", () => ({
  createClient: mocks.createClient,
}));
vi.mock("@/lib/supabase/mode", () => ({
  isDemoMode: () => false,
}));
vi.mock("@/lib/admin-step-up", () => ({
  requireRecentAdminAuthentication: mocks.requireRecentAdminAuthentication,
}));
vi.mock("@/lib/auth", () => ({
  createProfileIfMissing: vi.fn(),
  defaultPathForProfile: vi.fn(() => "/dashboard"),
  getAuthUserId: vi.fn(),
  getCurrentProfile: mocks.getCurrentProfile,
}));
vi.mock("next/cache", () => ({
  revalidatePath: mocks.revalidatePath,
}));
vi.mock("@/lib/google-drive", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/google-drive")>();
  return {
    ...actual,
    disconnectGoogleDrive: mocks.disconnectGoogleDrive,
  };
});
vi.mock("@/lib/notifications", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/notifications")>();
  return {
    ...actual,
    createNotification: mocks.createNotification,
  };
});

import {
  assignUserToDistrictAdministrator,
  deleteUserAccount,
  updateUserAccountStatus,
  updateUserRoleAndClubs,
} from "@/lib/actions";

describe("generic user-management action authorization", () => {
  const target = {
    id: "district-admin-1",
    school_id: null,
    district_id: "district-1",
    full_name: "District Administrator",
    email: "district@example.edu",
    grade_level: null,
    role: "district_admin" as const,
    account_status: "active" as const,
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getCurrentProfile.mockResolvedValue({
      id: "platform-admin-1",
      school_id: null,
      district_id: null,
      full_name: "Platform Administrator",
      email: "platform@example.edu",
      role: "super_admin",
      account_status: "active",
    });
    mocks.disconnectGoogleDrive.mockResolvedValue(undefined);
    mocks.createNotification.mockResolvedValue(undefined);
    mocks.requireRecentAdminAuthentication.mockResolvedValue(null);
  });

  it("does not let a crafted generic request demote an elevated account", async () => {
    const rpc = vi.fn();
    mocks.createClient.mockResolvedValue(createTargetLookupClient(target, rpc));
    mocks.createAdminClient.mockReturnValue(createTargetLookupClient(target, vi.fn()));

    await expect(updateUserRoleAndClubs({
      targetUserId: target.id,
      role: "admin",
      clubIds: [],
    })).resolves.toEqual({
      success: false,
      error: "You do not have permission to make this role change.",
    });
    expect(rpc).not.toHaveBeenCalled();
  });

  it("rejects a sensitive mutation before its RPC when identity confirmation is stale", async () => {
    const schoolTarget = {
      ...target,
      id: "student-step-up",
      school_id: "school-1",
      role: "student" as const,
    };
    const rpc = vi.fn();
    mocks.createClient.mockResolvedValue(createTargetLookupClient(schoolTarget, rpc));
    mocks.createAdminClient.mockReturnValue(createTargetLookupClient(schoolTarget, vi.fn()));
    mocks.requireRecentAdminAuthentication.mockResolvedValue({
      success: false,
      error: "Confirm your identity before making this sensitive administrative change.",
      reauthRequired: true,
    });

    await expect(updateUserRoleAndClubs({
      targetUserId: schoolTarget.id,
      role: "teacher",
      clubIds: [],
    })).resolves.toMatchObject({
      success: false,
      reauthRequired: true,
    });
    expect(rpc).not.toHaveBeenCalled();
  });

  it("does not let a crafted generic request delete an elevated account", async () => {
    const rpc = vi.fn();
    const deleteUser = vi.fn();
    mocks.createClient.mockResolvedValue(createTargetLookupClient(target, rpc));
    mocks.createAdminClient.mockReturnValue(createAdminManagementClient(target, { deleteUser }));

    await expect(deleteUserAccount(target.id)).resolves.toEqual({
      success: false,
      error: "You do not have permission to delete this account.",
    });
    expect(deleteUser).not.toHaveBeenCalled();
  });

  it("lets a platform administrator manage a school account through guarded RPCs", async () => {
    const schoolTarget = {
      ...target,
      id: "student-1",
      school_id: "school-1",
      district_id: "district-1",
      full_name: "School Student",
      email: "student@example.edu",
      role: "student" as const,
    };
    const rpc = vi.fn().mockResolvedValue({ error: null });
    const updateUserById = vi.fn().mockResolvedValue({ error: null });
    mocks.createClient.mockResolvedValue(createTargetLookupClient(schoolTarget, rpc));
    mocks.createAdminClient.mockReturnValue(
      createAdminManagementClient(schoolTarget, { updateUserById })
    );

    await expect(updateUserRoleAndClubs({
      targetUserId: schoolTarget.id,
      role: "student",
      clubIds: [],
    })).resolves.toEqual({ success: true });
    expect(rpc).toHaveBeenCalledWith("admin_set_user_role_and_clubs", {
      target_user_id: schoolTarget.id,
      new_role: "student",
      assigned_club_ids: [],
    });

    await expect(updateUserAccountStatus(
      schoolTarget.id,
      "suspended"
    )).resolves.toEqual({ success: true });
    expect(updateUserById).toHaveBeenCalledWith(schoolTarget.id, {
      ban_duration: "876000h",
    });
    expect(rpc).toHaveBeenCalledWith("admin_set_account_status", {
      target_user_id: schoolTarget.id,
      new_status: "suspended",
    });
  });

  it("assigns an eligible account to exactly one active district through the dedicated RPC", async () => {
    const schoolTarget = {
      ...target,
      id: "teacher-1",
      school_id: "school-1",
      role: "teacher" as const,
      account_status: "active" as const,
    };
    const rpc = vi.fn().mockResolvedValue({ error: null });
    mocks.createClient.mockResolvedValue({ rpc });
    mocks.createAdminClient.mockReturnValue({
      from: vi.fn((table: string) => ({
        select: vi.fn(() => ({
          eq: vi.fn(() => ({
            maybeSingle: vi.fn().mockResolvedValue({
              data: table === "profiles"
                ? schoolTarget
                : {
                    id: "district-1",
                    is_active: true,
                    access_disabled_at: null,
                  },
              error: null,
            }),
          })),
        })),
      })),
    });

    await expect(assignUserToDistrictAdministrator({
      targetUserId: schoolTarget.id,
      districtId: "district-1",
    })).resolves.toEqual({ success: true });
    expect(rpc).toHaveBeenCalledWith("assign_district_administrator", {
      target_user_id: schoolTarget.id,
      target_district_id: "district-1",
    });
    expect(mocks.createNotification).toHaveBeenCalledWith(expect.objectContaining({
      recipientUserId: schoolTarget.id,
      title: "You were promoted to district administrator",
    }));
  });

  it("lets a platform administrator delete a school account after guarded lookup", async () => {
    const schoolTarget = {
      ...target,
      id: "student-2",
      school_id: "school-1",
      full_name: "Departing Student",
      email: "departing@example.edu",
      role: "student" as const,
    };
    const deleteUser = vi.fn().mockResolvedValue({ error: null });
    const admin = createAdminManagementClient(schoolTarget, { deleteUser });
    mocks.createClient.mockResolvedValue(createTargetLookupClient(schoolTarget, vi.fn()));
    mocks.createAdminClient.mockReturnValue(admin);

    await expect(deleteUserAccount(schoolTarget.id)).resolves.toEqual({ success: true });
    expect(admin.rpc).toHaveBeenCalledWith("prepare_user_account_deletion", {
      target_user_id: schoolTarget.id,
    });
    expect(deleteUser).toHaveBeenCalledWith(schoolTarget.id);
  });

  it("removes transactionally rejected upload-intent objects before deleting the account", async () => {
    const schoolTarget = {
      ...target,
      id: "student-3",
      school_id: "school-1",
      full_name: "Uploading Student",
      email: "uploading@example.edu",
      role: "student" as const,
    };
    const deleteUser = vi.fn().mockResolvedValue({ error: null });
    const remove = vi.fn().mockResolvedValue({ data: [], error: null });
    const intentUpdate = vi.fn();
    const pendingPath = "assignment/submissions/student-3/pending.pdf";
    const admin = createAdminManagementClient(schoolTarget, {
      deleteUser,
      remove,
      unfinishedUploads: [{ id: "intent-1", storage_path: pendingPath }],
      intentUpdate,
    });
    mocks.createClient.mockResolvedValue(createTargetLookupClient(schoolTarget, vi.fn()));
    mocks.createAdminClient.mockReturnValue(admin);

    await expect(deleteUserAccount(schoolTarget.id)).resolves.toEqual({ success: true });

    expect(remove).toHaveBeenCalledWith([pendingPath]);
    expect(intentUpdate).not.toHaveBeenCalled();
    expect(admin.rpc).toHaveBeenCalledWith("finalize_user_account_deletion", {
      target_execution_id: "deletion-execution-1",
      requested_status: "completed",
      requested_error: null,
    });
    expect(deleteUser).toHaveBeenCalledWith(schoolTarget.id);
  });

  it("retries the idempotent failure finalizer and releases the prepared barrier", async () => {
    const schoolTarget = {
      ...target,
      id: "student-4",
      school_id: "school-1",
      full_name: "Cleanup Failure Student",
      email: "cleanup-failure@example.edu",
      role: "student" as const,
    };
    const deleteUser = vi.fn().mockResolvedValue({ error: null });
    const remove = vi.fn().mockResolvedValue({
      data: null,
      error: { message: "Storage unavailable" },
    });
    const admin = createAdminManagementClient(schoolTarget, {
      deleteUser,
      remove,
      unfinishedUploads: [{
        id: "intent-2",
        storage_path: "assignment/submissions/student-4/pending.pdf",
      }],
    });
    let failureFinalizationAttempts = 0;
    admin.rpc.mockImplementation((name: string, args?: Record<string, unknown>) => {
      if (name === "prepare_user_account_deletion") {
        return Promise.resolve({ data: "deletion-execution-1", error: null });
      }
      if (name === "finalize_user_account_deletion"
        && args?.requested_status === "failed") {
        failureFinalizationAttempts += 1;
        return Promise.resolve(
          failureFinalizationAttempts === 1
            ? { data: null, error: { message: "Transient RPC failure" } }
            : { data: true, error: null }
        );
      }
      return Promise.resolve({ data: null, error: null });
    });
    mocks.createClient.mockResolvedValue(createTargetLookupClient(schoolTarget, vi.fn()));
    mocks.createAdminClient.mockReturnValue(admin);

    await expect(deleteUserAccount(schoolTarget.id)).resolves.toEqual({
      success: false,
      error: "Could not remove the account's private coursework files.",
    });

    expect(failureFinalizationAttempts).toBe(2);
    expect(admin.rpc).toHaveBeenCalledWith("finalize_user_account_deletion", {
      target_execution_id: "deletion-execution-1",
      requested_status: "failed",
      requested_error: expect.stringContaining("Storage unavailable"),
    });
    expect(deleteUser).not.toHaveBeenCalled();
  });
});

function createTargetLookupClient(
  target: Record<string, unknown>,
  rpc: ReturnType<typeof vi.fn>
) {
  return {
    rpc,
    from: vi.fn(() => ({
      select: vi.fn(() => ({
        eq: vi.fn(() => ({
          maybeSingle: vi.fn().mockResolvedValue({ data: target, error: null }),
        })),
      })),
    })),
  };
}

function createAdminManagementClient(
  target: Record<string, unknown>,
  authAdmin: {
    deleteUser?: ReturnType<typeof vi.fn>;
    updateUserById?: ReturnType<typeof vi.fn>;
    remove?: ReturnType<typeof vi.fn>;
    unfinishedUploads?: Array<{ id: string; storage_path: string }>;
    submittedFiles?: Array<{ id: string; storage_path: string }>;
    intentUpdate?: (values: Record<string, unknown>) => unknown;
  }
) {
  const pagedQuery = (
    rows: Array<Record<string, unknown>> = [],
    onUpdate?: (values: Record<string, unknown>) => unknown
  ) => {
    const query: Record<string, any> = {};
    query.select = vi.fn(() => query);
    query.eq = vi.fn(() => query);
    query.neq = vi.fn(() => query);
    query.order = vi.fn(() => query);
    query.range = vi.fn().mockResolvedValue({ data: rows, error: null });
    query.update = vi.fn((values: Record<string, unknown>) => {
      onUpdate?.(values);
      return query;
    });
    query.in = vi.fn(() => query);
    query.then = (
      resolve: (value: { data: unknown[]; error: null }) => unknown,
      reject: (reason: unknown) => unknown
    ) => Promise.resolve({ data: rows, error: null }).then(resolve, reject);
    return query;
  };
  const mutationQuery = {
    update: vi.fn(() => ({
      eq: vi.fn().mockResolvedValue({ error: null }),
    })),
    delete: vi.fn(() => ({
      eq: vi.fn().mockResolvedValue({ error: null }),
    })),
  };
  const rpc: ReturnType<typeof vi.fn> = vi.fn((name: string) => Promise.resolve({
      data: name === "prepare_user_account_deletion"
        ? "deletion-execution-1"
        : name === "finalize_user_account_deletion"
          ? true
          : null,
      error: null,
    }));
  return {
    rpc,
    auth: {
      admin: {
        deleteUser: authAdmin.deleteUser ?? vi.fn(),
        updateUserById: authAdmin.updateUserById ?? vi.fn(),
      },
    },
    storage: {
      from: vi.fn(() => ({
        remove: authAdmin.remove ?? vi.fn().mockResolvedValue({ error: null }),
      })),
    },
    from: vi.fn((table: string) => {
      if (table === "profiles") {
        return createTargetLookupClient(target, vi.fn()).from();
      }
      if (table === "club_assignment_attachments") {
        return pagedQuery();
      }
      if (table === "club_submission_attachments") {
        return pagedQuery(authAdmin.submittedFiles);
      }
      if (table === "coursework_upload_intents") {
        return pagedQuery(authAdmin.unfinishedUploads, authAdmin.intentUpdate);
      }
      return mutationQuery;
    }),
  };
}
