import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  createClient: vi.fn(),
  createAdminClient: vi.fn(),
  getCurrentProfile: vi.fn(),
  getManagedClubBySlug: vi.fn(),
  revalidatePath: vi.fn(),
}));

vi.mock("@/lib/supabase/server", () => ({
  createClient: mocks.createClient,
}));
vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: mocks.createAdminClient,
}));
vi.mock("@/lib/supabase/mode", () => ({
  isDemoMode: () => false,
}));
vi.mock("@/lib/auth", () => ({
  createProfileIfMissing: vi.fn(),
  defaultPathForProfile: vi.fn(() => "/dashboard"),
  getAuthUserId: vi.fn(),
  getCurrentProfile: mocks.getCurrentProfile,
}));
vi.mock("@/lib/data", () => ({
  getClubBySlug: vi.fn(),
  getManagedClubBySlug: mocks.getManagedClubBySlug,
}));
vi.mock("next/cache", () => ({
  revalidatePath: mocks.revalidatePath,
}));

import {
  prepareCourseworkFileUpload,
  registerCourseworkFileUpload,
  removeCourseworkAttachment,
} from "@/lib/actions";

const profile = {
  id: "10000000-0000-4000-8000-000000000001",
  school_id: "20000000-0000-4000-8000-000000000001",
  full_name: "Upload Advisor",
  email: "advisor@example.test",
  role: "teacher" as const,
  account_status: "active" as const,
};
const club = {
  id: "30000000-0000-4000-8000-000000000001",
  school_id: profile.school_id,
  name: "Upload Club",
  slug: "upload-club",
  status: "active" as const,
  is_featured: false,
  is_listed: true,
  is_active: true,
  visibility: "public" as const,
};
const assignmentId = "40000000-0000-4000-8000-000000000001";

function queryResult(data: unknown) {
  const query: Record<string, any> = {};
  query.select = vi.fn(() => query);
  query.eq = vi.fn(() => query);
  query.maybeSingle = vi.fn().mockResolvedValue({
    data: Array.isArray(data) ? data[0] ?? null : data,
    error: null,
  });
  query.then = (
    resolve: (value: { data: unknown; error: null }) => unknown,
    reject: (reason: unknown) => unknown
  ) => Promise.resolve({ data, error: null }).then(resolve, reject);
  return query;
}

function courseworkClient() {
  return {
    from: vi.fn((table: string) => {
      if (table === "club_memberships") {
        return queryResult({
          club_id: club.id,
          status: "active",
          role: "sponsor",
        });
      }
      if (table === "club_assignments") return queryResult({ id: assignmentId });
      throw new Error(`Unexpected user-client table: ${table}`);
    }),
  };
}

describe("direct coursework upload actions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getCurrentProfile.mockResolvedValue(profile);
    mocks.getManagedClubBySlug.mockResolvedValue(club);
    mocks.createClient.mockResolvedValue(courseworkClient());
  });

  it("binds a normalized MIME type and exact metadata before issuing a signed token", async () => {
    const rpc = vi.fn()
      .mockResolvedValueOnce({ data: "intent-1", error: null });
    const createSignedUploadUrl = vi.fn().mockResolvedValue({
      data: { token: "signed-token" },
      error: null,
    });
    const admin = {
      rpc,
      from: vi.fn((table: string) => {
        if (table === "club_assignment_attachments") return queryResult([]);
        throw new Error(`Unexpected admin table: ${table}`);
      }),
      storage: {
        from: vi.fn(() => ({ createSignedUploadUrl })),
      },
    };
    mocks.createAdminClient.mockReturnValue(admin);

    const result = await prepareCourseworkFileUpload({
      clubSlug: club.slug,
      assignmentId,
      target: "assignment",
      fileName: "Report.pdf",
      fileSize: 9,
      mimeType: "",
    });

    expect(result).toEqual(expect.objectContaining({
      success: true,
      intentId: "intent-1",
      token: "signed-token",
      fileName: "Report.pdf",
      mimeType: "application/pdf",
    }));
    expect(result.path).toMatch(
      new RegExp(`^${assignmentId}/materials/${profile.id}/[0-9a-f-]+-Report\\.pdf$`)
    );
    expect(rpc).toHaveBeenCalledWith("create_coursework_upload_intent", {
      actor_user_uuid: profile.id,
      assignment_uuid: assignmentId,
      upload_target: "assignment",
      object_path: result.path,
      expected_file_name: "Report.pdf",
      expected_mime_type: "application/pdf",
      expected_file_size: 9,
    });
    expect(rpc.mock.invocationCallOrder[0]).toBeLessThan(
      createSignedUploadUrl.mock.invocationCallOrder[0]
    );
  });

  it("re-reads an ambiguous registration result and preserves a committed object", async () => {
    const storagePath =
      `${assignmentId}/materials/${profile.id}/50000000-0000-4000-8000-000000000001-report.pdf`;
    const pendingIntent = {
      id: "intent-2",
      user_id: profile.id,
      assignment_id: assignmentId,
      target: "assignment",
      storage_path: storagePath,
      file_name: "report.pdf",
      mime_type: "application/pdf",
      expected_size: 9,
      status: "pending",
      expires_at: new Date(Date.now() + 60_000).toISOString(),
      attachment_id: null,
    };
    const intentReads = [
      pendingIntent,
      { status: "registered", attachment_id: "attachment-2" },
    ];
    const remove = vi.fn().mockResolvedValue({ data: [], error: null });
    const rpc = vi.fn().mockImplementation(async (name: string) => {
      if (name === "register_coursework_upload_intent") {
        return { data: null, error: { message: "Response interrupted" } };
      }
      return { data: null, error: null };
    });
    const admin = {
      rpc,
      from: vi.fn((table: string) => {
        if (table === "coursework_upload_intents") {
          return queryResult(intentReads.shift() ?? null);
        }
        throw new Error(`Unexpected admin table: ${table}`);
      }),
      storage: {
        from: vi.fn(() => ({
          list: vi.fn().mockResolvedValue({
            data: [{
              name: storagePath.split("/").pop(),
              metadata: { size: 9, mimetype: "application/pdf" },
            }],
            error: null,
          }),
          download: vi.fn().mockResolvedValue({
            data: new Blob(["%PDF-1.7\n"], { type: "application/pdf" }),
            error: null,
          }),
          remove,
        })),
      },
    };
    mocks.createAdminClient.mockReturnValue(admin);

    const result = await registerCourseworkFileUpload({
      clubSlug: club.slug,
      assignmentId,
      target: "assignment",
      intentId: "intent-2",
      storagePath,
      fileName: "report.pdf",
      fileSize: 9,
      mimeType: "application/pdf",
    });

    expect(result).toEqual({ success: true, attachmentId: "attachment-2" });
    expect(remove).not.toHaveBeenCalled();
    expect(rpc).toHaveBeenCalledWith(
      "register_coursework_upload_intent",
      expect.objectContaining({ intent_uuid: "intent-2", object_path: storagePath })
    );
  });

  it("keeps attachment metadata when private Storage deletion fails", async () => {
    const storagePath = `${assignmentId}/materials/${profile.id}/attachment.pdf`;
    const attachmentQuery = queryResult({
      id: "attachment-3",
      source_type: "upload",
      storage_path: storagePath,
    });
    const deleteQuery = queryResult(null);
    deleteQuery.delete = vi.fn(() => deleteQuery);
    const remove = vi.fn().mockResolvedValue({
      data: null,
      error: { message: "Storage unavailable" },
    });
    const from = vi.fn()
      .mockReturnValueOnce(attachmentQuery)
      .mockReturnValueOnce(deleteQuery);
    mocks.createAdminClient.mockReturnValue({
      from,
      storage: { from: vi.fn(() => ({ remove })) },
    });

    const result = await removeCourseworkAttachment({
      clubSlug: club.slug,
      assignmentId,
      target: "assignment",
      attachmentId: "attachment-3",
    });

    expect(result).toEqual({
      success: false,
      error: "Could not remove the private file. The attachment was kept so cleanup can be retried.",
    });
    expect(remove).toHaveBeenCalledWith([storagePath]);
    expect(from).toHaveBeenCalledTimes(1);
    expect(deleteQuery.delete).not.toHaveBeenCalled();
  });

  it("removes a private object before atomically terminalizing its upload intent", async () => {
    const storagePath = `${assignmentId}/materials/${profile.id}/attachment.pdf`;
    const attachmentQuery = queryResult({
      id: "attachment-4",
      source_type: "upload",
      storage_path: storagePath,
    });
    const remove = vi.fn().mockResolvedValue({ data: [], error: null });
    const from = vi.fn().mockReturnValueOnce(attachmentQuery);
    const rpc = vi.fn().mockResolvedValue({ data: true, error: null });
    mocks.createAdminClient.mockReturnValue({
      from,
      rpc,
      storage: { from: vi.fn(() => ({ remove })) },
    });

    const result = await removeCourseworkAttachment({
      clubSlug: club.slug,
      assignmentId,
      target: "assignment",
      attachmentId: "attachment-4",
    });

    expect(result).toEqual({ success: true });
    expect(remove).toHaveBeenCalledWith([storagePath]);
    expect(from).toHaveBeenCalledTimes(1);
    expect(rpc).toHaveBeenCalledWith("finalize_coursework_attachment_removal", {
      target_attachment_id: "attachment-4",
      target_assignment_id: assignmentId,
      target_attachment_kind: "assignment",
      expected_storage_path: storagePath,
    });
    expect(remove.mock.invocationCallOrder[0]).toBeLessThan(
      rpc.mock.invocationCallOrder[0]
    );
  });
});
