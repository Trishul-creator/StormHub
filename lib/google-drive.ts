import "server-only";

import {
  createCipheriv,
  createDecipheriv,
  randomBytes,
} from "node:crypto";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  getGoogleDriveServerConfig,
  isGoogleDrivePickerConfigured,
} from "@/lib/env";
import { safeAuthRedirectPath } from "@/lib/auth-redirect";
import type { GoogleDriveConnectionStatus } from "@/types/database";

const DRIVE_SCOPE = "https://www.googleapis.com/auth/drive.file";
const GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token";
const GOOGLE_USERINFO_URL = "https://openidconnect.googleapis.com/v1/userinfo";
const DRIVE_FILES_URL = "https://www.googleapis.com/drive/v3/files";
const MAX_READ_ONLY_FILE_BYTES = 25 * 1024 * 1024;

interface StoredGoogleConnection {
  user_id: string;
  google_email?: string | null;
  access_token_encrypted: string;
  refresh_token_encrypted?: string | null;
  token_expires_at?: string | null;
  granted_scopes?: string | null;
}

export interface GoogleDriveFile {
  id: string;
  name: string;
  mimeType?: string;
  size?: string;
  webViewLink?: string;
  iconLink?: string;
  capabilities?: {
    canCopy?: boolean;
  };
}

export interface GoogleOAuthState {
  userId: string;
  nonce: string;
  returnTo: string;
  expiresAt: number;
}

function encryptionKey(): Buffer {
  const config = getGoogleDriveServerConfig();
  if (!config) throw new Error("Google Drive is not configured.");
  const configured = config.tokenEncryptionKey;
  const decoded = /^[a-f0-9]{64}$/i.test(configured)
    ? Buffer.from(configured, "hex")
    : Buffer.from(configured, "base64");
  if (decoded.length === 32) return decoded;
  throw new Error("GOOGLE_DRIVE_TOKEN_ENCRYPTION_KEY must decode to exactly 32 bytes.");
}

export function encryptGoogleToken(value: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", encryptionKey(), iv);
  const encrypted = Buffer.concat([cipher.update(value, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return ["v1", iv.toString("base64url"), tag.toString("base64url"), encrypted.toString("base64url")].join(".");
}

export function decryptGoogleToken(value: string): string {
  const [version, iv, tag, encrypted] = value.split(".");
  if (version !== "v1" || !iv || !tag || !encrypted) {
    throw new Error("Stored Google Drive credentials are invalid.");
  }
  const ivBytes = decodeCanonicalBase64Url(iv);
  const tagBytes = decodeCanonicalBase64Url(tag);
  const encryptedBytes = decodeCanonicalBase64Url(encrypted);
  const decipher = createDecipheriv("aes-256-gcm", encryptionKey(), ivBytes);
  decipher.setAuthTag(tagBytes);
  return Buffer.concat([
    decipher.update(encryptedBytes),
    decipher.final(),
  ]).toString("utf8");
}

function decodeCanonicalBase64Url(value: string): Buffer {
  const decoded = Buffer.from(value, "base64url");
  if (!decoded.length || decoded.toString("base64url") !== value) {
    throw new Error("Stored Google Drive credentials are invalid.");
  }
  return decoded;
}

function safeReturnTo(value?: string | null): string {
  return safeAuthRedirectPath(value, "/settings");
}

export function createGoogleOAuthState(input: {
  userId: string;
  nonce: string;
  returnTo?: string | null;
}): string {
  const state: GoogleOAuthState = {
    userId: input.userId,
    nonce: input.nonce,
    returnTo: safeReturnTo(input.returnTo),
    expiresAt: Date.now() + 10 * 60 * 1000,
  };
  return encryptGoogleToken(JSON.stringify(state));
}

export function verifyGoogleOAuthState(value: string): GoogleOAuthState | null {
  try {
    const parsed = JSON.parse(decryptGoogleToken(value)) as GoogleOAuthState;
    if (
      !parsed.userId
      || !parsed.nonce
      || parsed.expiresAt < Date.now()
      || safeReturnTo(parsed.returnTo) !== parsed.returnTo
    ) {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

export function buildGoogleAuthorizationUrl(state: string): string {
  const config = getGoogleDriveServerConfig();
  if (!config) throw new Error("Google Drive is not configured.");
  const url = new URL("https://accounts.google.com/o/oauth2/v2/auth");
  url.searchParams.set("client_id", config.clientId);
  url.searchParams.set("redirect_uri", config.redirectUri);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("scope", `openid email ${DRIVE_SCOPE}`);
  url.searchParams.set("access_type", "offline");
  url.searchParams.set("include_granted_scopes", "true");
  url.searchParams.set("prompt", "consent");
  url.searchParams.set("state", state);
  return url.toString();
}

export async function exchangeGoogleAuthorizationCode(code: string): Promise<{
  accessToken: string;
  refreshToken?: string;
  expiresAt: string;
  scope?: string;
  googleEmail?: string | null;
}> {
  const config = getGoogleDriveServerConfig();
  if (!config) throw new Error("Google Drive is not configured.");
  const response = await fetch(GOOGLE_TOKEN_URL, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: config.clientId,
      client_secret: config.clientSecret,
      redirect_uri: config.redirectUri,
      grant_type: "authorization_code",
    }),
    cache: "no-store",
  });
  const payload = await response.json() as {
    access_token?: string;
    refresh_token?: string;
    expires_in?: number;
    scope?: string;
    error_description?: string;
  };
  if (!response.ok || !payload.access_token) {
    throw new Error(payload.error_description || "Google did not return an access token.");
  }

  let googleEmail: string | null = null;
  const userInfoResponse = await fetch(GOOGLE_USERINFO_URL, {
    headers: { authorization: `Bearer ${payload.access_token}` },
    cache: "no-store",
  });
  if (userInfoResponse.ok) {
    const userInfo = await userInfoResponse.json() as { email?: string };
    googleEmail = userInfo.email ?? null;
  }

  return {
    accessToken: payload.access_token,
    refreshToken: payload.refresh_token,
    expiresAt: new Date(Date.now() + Math.max(60, payload.expires_in ?? 3600) * 1000).toISOString(),
    scope: payload.scope,
    googleEmail,
  };
}

export async function saveGoogleDriveConnection(input: {
  userId: string;
  accessToken: string;
  refreshToken?: string;
  expiresAt: string;
  scope?: string;
  googleEmail?: string | null;
}): Promise<void> {
  const admin = createAdminClient();
  if (!admin) throw new Error("Google Drive storage is unavailable.");
  const { data: existing } = await admin
    .from("google_drive_connections")
    .select("refresh_token_encrypted")
    .eq("user_id", input.userId)
    .maybeSingle();
  const refreshTokenEncrypted = input.refreshToken
    ? encryptGoogleToken(input.refreshToken)
    : (existing as { refresh_token_encrypted?: string | null } | null)?.refresh_token_encrypted ?? null;
  const { error } = await admin.from("google_drive_connections").upsert({
    user_id: input.userId,
    google_email: input.googleEmail ?? null,
    access_token_encrypted: encryptGoogleToken(input.accessToken),
    refresh_token_encrypted: refreshTokenEncrypted,
    token_expires_at: input.expiresAt,
    granted_scopes: input.scope ?? DRIVE_SCOPE,
  });
  if (error) throw new Error("Could not securely save the Google Drive connection.");
}

async function loadGoogleConnection(userId: string): Promise<StoredGoogleConnection | null> {
  const admin = createAdminClient();
  if (!admin) return null;
  const { data, error } = await admin
    .from("google_drive_connections")
    .select("*")
    .eq("user_id", userId)
    .maybeSingle();
  if (error) throw new Error("Could not load the Google Drive connection.");
  return (data as StoredGoogleConnection | null) ?? null;
}

export async function getGoogleDriveConnectionStatus(userId: string): Promise<GoogleDriveConnectionStatus> {
  const connection = await loadGoogleConnection(userId);
  return {
    configured: isGoogleDrivePickerConfigured(),
    connected: Boolean(connection),
    google_email: connection?.google_email ?? null,
  };
}

export async function disconnectGoogleDrive(userId: string): Promise<void> {
  const admin = createAdminClient();
  if (!admin) throw new Error("Google Drive storage is unavailable.");
  const connection = await loadGoogleConnection(userId);
  if (connection) {
    try {
      const accessToken = decryptGoogleToken(connection.access_token_encrypted);
      await fetch(`https://oauth2.googleapis.com/revoke?token=${encodeURIComponent(accessToken)}`, {
        method: "POST",
        headers: { "content-type": "application/x-www-form-urlencoded" },
        cache: "no-store",
      });
    } catch {
      // A revoked or expired token should not prevent local disconnection.
    }
  }
  const { error } = await admin.from("google_drive_connections").delete().eq("user_id", userId);
  if (error) throw new Error("Could not disconnect Google Drive.");
}

export async function getGoogleDriveAccessToken(userId: string): Promise<string> {
  const connection = await loadGoogleConnection(userId);
  if (!connection) throw new Error("GOOGLE_DRIVE_RECONNECT_REQUIRED");
  const expiresAt = connection.token_expires_at
    ? new Date(connection.token_expires_at).getTime()
    : 0;
  if (expiresAt > Date.now() + 60_000) {
    return decryptGoogleToken(connection.access_token_encrypted);
  }
  if (!connection.refresh_token_encrypted) {
    throw new Error("GOOGLE_DRIVE_RECONNECT_REQUIRED");
  }
  const config = getGoogleDriveServerConfig();
  if (!config) throw new Error("Google Drive is not configured.");
  const response = await fetch(GOOGLE_TOKEN_URL, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: config.clientId,
      client_secret: config.clientSecret,
      refresh_token: decryptGoogleToken(connection.refresh_token_encrypted),
      grant_type: "refresh_token",
    }),
    cache: "no-store",
  });
  const payload = await response.json() as {
    access_token?: string;
    expires_in?: number;
    scope?: string;
  };
  if (!response.ok || !payload.access_token) {
    throw new Error("GOOGLE_DRIVE_RECONNECT_REQUIRED");
  }
  await saveGoogleDriveConnection({
    userId,
    accessToken: payload.access_token,
    expiresAt: new Date(Date.now() + Math.max(60, payload.expires_in ?? 3600) * 1000).toISOString(),
    scope: payload.scope ?? connection.granted_scopes ?? DRIVE_SCOPE,
    googleEmail: connection.google_email,
  });
  return payload.access_token;
}

async function driveRequest<T>(
  userId: string,
  url: string,
  init: RequestInit = {}
): Promise<T> {
  const accessToken = await getGoogleDriveAccessToken(userId);
  const response = await fetch(url, {
    ...init,
    headers: {
      authorization: `Bearer ${accessToken}`,
      ...(init.body ? { "content-type": "application/json" } : {}),
      ...init.headers,
    },
    cache: "no-store",
  });
  if (!response.ok) {
    const payload = await response.json().catch(() => null) as {
      error?: { message?: string };
    } | null;
    throw new Error(payload?.error?.message || `Google Drive request failed (${response.status}).`);
  }
  return response.status === 204 ? (undefined as T) : response.json() as Promise<T>;
}

export async function getGoogleDriveFile(userId: string, fileId: string): Promise<GoogleDriveFile> {
  const safeFileId = encodeURIComponent(fileId);
  return driveRequest<GoogleDriveFile>(
    userId,
    `${DRIVE_FILES_URL}/${safeFileId}?fields=id,name,mimeType,size,webViewLink,iconLink,capabilities(canCopy)&supportsAllDrives=true`
  );
}

export async function ensureGoogleDrivePermission(input: {
  ownerUserId: string;
  fileId: string;
  recipientEmail: string;
  role: "reader" | "commenter" | "writer";
}): Promise<void> {
  const existing = await driveRequest<{
    permissions?: Array<{ emailAddress?: string; role?: string }>;
  }>(
    input.ownerUserId,
    `${DRIVE_FILES_URL}/${encodeURIComponent(input.fileId)}/permissions?fields=permissions(emailAddress,role)&supportsAllDrives=true`
  );
  const currentPermission = existing.permissions?.find(
    (permission) => permission.emailAddress?.toLowerCase() === input.recipientEmail.toLowerCase()
  );
  const sufficientRoles = input.role === "reader"
    ? ["reader", "commenter", "writer", "owner"]
    : input.role === "commenter" ? ["commenter", "writer", "owner"] : ["writer", "owner"];
  if (currentPermission?.role && sufficientRoles.includes(currentPermission.role)) return;
  await driveRequest(
    input.ownerUserId,
    `${DRIVE_FILES_URL}/${encodeURIComponent(input.fileId)}/permissions?sendNotificationEmail=false&supportsAllDrives=true`,
    {
      method: "POST",
      body: JSON.stringify({
        type: "user",
        role: input.role,
        emailAddress: input.recipientEmail,
      }),
    }
  );
}

export async function createReadOnlyGoogleDriveFileResponse(input: {
  ownerUserId: string;
  fileId: string;
}): Promise<Response> {
  const file = await getGoogleDriveFile(input.ownerUserId, input.fileId);
  const accessToken = await getGoogleDriveAccessToken(input.ownerUserId);
  const isWorkspaceFile = isGoogleWorkspaceFile(file.mimeType);
  const downloadMimeType = isWorkspaceFile ? "application/pdf" : file.mimeType || "application/octet-stream";
  const url = isWorkspaceFile
    ? `${DRIVE_FILES_URL}/${encodeURIComponent(input.fileId)}/export?mimeType=${encodeURIComponent(downloadMimeType)}`
    : `${DRIVE_FILES_URL}/${encodeURIComponent(input.fileId)}?alt=media&supportsAllDrives=true`;
  const response = await fetch(url, {
    headers: { authorization: `Bearer ${accessToken}` },
    cache: "no-store",
  });
  if (!response.ok) {
    throw new Error(
      isWorkspaceFile
        ? "This Google Workspace file cannot be opened in a read-only support preview."
        : "Google Drive could not prepare this file for read-only support."
    );
  }
  const body = await response.arrayBuffer();
  if (body.byteLength > MAX_READ_ONLY_FILE_BYTES) {
    throw new Error("This file is too large for the read-only support preview.");
  }
  const baseName = file.name.replace(/[\r\n]/g, " ").trim() || "Google Drive file";
  const fileName = isWorkspaceFile && !baseName.toLowerCase().endsWith(".pdf")
    ? `${baseName}.pdf`
    : baseName;
  return new Response(body, {
    headers: {
      "cache-control": "private, no-store",
      "content-disposition": `inline; filename*=UTF-8''${encodeURIComponent(fileName)}`,
      "content-type": downloadMimeType,
      "x-content-type-options": "nosniff",
    },
  });
}

export async function copyGoogleDriveFileForStudent(input: {
  teacherUserId: string;
  templateFileId: string;
  copyName: string;
  studentEmail: string;
}): Promise<GoogleDriveFile> {
  const copy = await driveRequest<GoogleDriveFile>(
    input.teacherUserId,
    `${DRIVE_FILES_URL}/${encodeURIComponent(input.templateFileId)}/copy?fields=id,name,mimeType,webViewLink&supportsAllDrives=true`,
    {
      method: "POST",
      body: JSON.stringify({ name: input.copyName }),
    }
  );
  try {
    await ensureGoogleDrivePermission({
      ownerUserId: input.teacherUserId,
      fileId: copy.id,
      recipientEmail: input.studentEmail,
      role: "writer",
    });
  } catch (error) {
    await driveRequest<void>(
      input.teacherUserId,
      `${DRIVE_FILES_URL}/${encodeURIComponent(copy.id)}?supportsAllDrives=true`,
      { method: "DELETE" }
    ).catch(() => undefined);
    throw error;
  }
  return copy;
}

export function isGoogleWorkspaceFile(mimeType?: string | null): boolean {
  return Boolean(mimeType?.startsWith("application/vnd.google-apps."));
}

export function isCopyableGoogleWorkspaceFile(mimeType?: string | null): boolean {
  return new Set([
    "application/vnd.google-apps.document",
    "application/vnd.google-apps.spreadsheet",
    "application/vnd.google-apps.presentation",
    "application/vnd.google-apps.drawing",
    "application/vnd.google-apps.form",
  ]).has(mimeType ?? "");
}

export function isGoogleDriveReconnectError(error: unknown): boolean {
  return error instanceof Error && error.message === "GOOGLE_DRIVE_RECONNECT_REQUIRED";
}
