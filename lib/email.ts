import "server-only";

import { randomUUID } from "node:crypto";
import { createAdminClient } from "@/lib/supabase/admin";
import { isDemoMode } from "@/lib/supabase/mode";
import type { EmailOutboxItem } from "@/types/database";
import { getEmailDeliveryMode as resolveEmailDeliveryMode } from "@/lib/env";

interface SendEmailInput {
  to: string;
  subject: string;
  body: string;
  idempotencyKey?: string;
}

export interface SendEmailResult {
  success: boolean;
  error?: string;
  providerMessageId?: string;
  retryable?: boolean;
  skipped?: boolean;
}

interface ClaimedEmailOutboxItem
  extends Pick<EmailOutboxItem, "id" | "recipient_email" | "subject" | "body"> {
  attempt_count: number;
}

const MAX_QUEUE_ATTEMPTS = 5;
const DEFAULT_PROVIDER_TIMEOUT_MS = 6_000;
const DEFAULT_PROVIDER_ATTEMPTS = 2;
const OUTBOX_CONCURRENCY = 8;

export function getEmailDeliveryMode(): "disabled" | "outbox_only" | "send" {
  return resolveEmailDeliveryMode();
}

export function isEmailDeliveryEnabled(): boolean {
  return getEmailDeliveryMode() === "send";
}

export function isEmailOutboxEnabled(): boolean {
  return getEmailDeliveryMode() !== "disabled";
}

const appUrl = () =>
  process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "") || process.env.APP_URL?.replace(/\/$/, "") || "";

function withAbsoluteLinks(body: string) {
  const baseUrl = appUrl();
  if (!baseUrl) return body;
  return body.replace(/Open in StormHub: (\/\S*)/g, `Open in StormHub: ${baseUrl}$1`);
}

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll("\"", "&quot;")
    .replaceAll("'", "&#039;");
}

function toHtml(body: string) {
  return `<div style="font-family:Arial,sans-serif;line-height:1.5;color:#172033">${escapeHtml(body)
    .split("\n")
    .map((line) => (line.trim() ? `<p>${line}</p>` : ""))
    .join("")}</div>`;
}

function boundedInteger(
  value: string | undefined,
  fallback: number,
  minimum: number,
  maximum: number,
) {
  const parsed = Number.parseInt(value ?? "", 10);
  return Number.isFinite(parsed)
    ? Math.min(maximum, Math.max(minimum, parsed))
    : fallback;
}

function providerTimeoutMs() {
  return boundedInteger(
    process.env.EMAIL_PROVIDER_TIMEOUT_MS,
    DEFAULT_PROVIDER_TIMEOUT_MS,
    1_000,
    15_000,
  );
}

function providerAttempts() {
  return boundedInteger(
    process.env.EMAIL_PROVIDER_MAX_ATTEMPTS,
    DEFAULT_PROVIDER_ATTEMPTS,
    1,
    3,
  );
}

function providerRetryDelayMs(attempt: number) {
  const base = boundedInteger(process.env.EMAIL_PROVIDER_RETRY_DELAY_MS, 250, 0, 2_000);
  return Math.min(2_000, base * (2 ** Math.max(0, attempt - 1)));
}

function providerStatusIsRetryable(status: number) {
  return status === 408 || status === 409 || status === 425 || status === 429 || status >= 500;
}

async function readProviderResponse(response: Response): Promise<{
  id?: string;
  error?: string;
}> {
  const raw = await response.text().catch(() => "");
  if (!raw) return {};
  try {
    const payload = JSON.parse(raw) as {
      id?: string;
      message?: string;
      error?: string | { message?: string };
    };
    return {
      id: payload.id,
      error: payload.message
        || (typeof payload.error === "string" ? payload.error : payload.error?.message),
    };
  } catch {
    return { error: raw.slice(0, 500) };
  }
}

async function waitForProviderRetry(attempt: number) {
  const delay = providerRetryDelayMs(attempt);
  if (delay > 0) {
    await new Promise((resolve) => setTimeout(resolve, delay));
  }
}

async function sendWithResend(input: SendEmailInput): Promise<SendEmailResult> {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.EMAIL_FROM;
  const replyTo = process.env.EMAIL_REPLY_TO;
  if (!apiKey || !from) {
    return { success: false, error: "Missing RESEND_API_KEY or EMAIL_FROM." };
  }

  const text = withAbsoluteLinks(input.body);
  const maxAttempts = providerAttempts();
  let lastResult: SendEmailResult = {
    success: false,
    error: "Email provider request failed.",
    retryable: true,
  };

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    try {
      const response = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
          "User-Agent": "stormhub/1.0",
          ...(input.idempotencyKey ? { "Idempotency-Key": input.idempotencyKey } : {}),
        },
        body: JSON.stringify({
          from,
          to: [input.to],
          subject: input.subject,
          text,
          html: toHtml(text),
          ...(replyTo ? { reply_to: replyTo } : {}),
        }),
        signal: AbortSignal.timeout(providerTimeoutMs()),
      });
      const details = await readProviderResponse(response);
      if (response.ok) {
        return {
          success: true,
          providerMessageId: details.id,
          retryable: false,
        };
      }

      const retryable = providerStatusIsRetryable(response.status);
      lastResult = {
        success: false,
        error: details.error || `Resend request failed with ${response.status}.`,
        retryable,
      };
      if (!retryable || attempt === maxAttempts) return lastResult;
    } catch (error) {
      const timedOut = error instanceof Error
        && (error.name === "TimeoutError" || error.name === "AbortError");
      lastResult = {
        success: false,
        error: timedOut
          ? "Email provider request timed out."
          : "Email provider could not be reached.",
        retryable: true,
      };
      if (attempt === maxAttempts) return lastResult;
    }

    await waitForProviderRetry(attempt);
  }

  return lastResult;
}

export async function sendEmail(input: SendEmailInput): Promise<SendEmailResult> {
  if (isDemoMode()) return { success: true };

  switch (getEmailDeliveryMode()) {
    case "send":
      return sendWithResend(input);
    case "outbox_only":
      return { success: true };
    case "disabled":
      return { success: true };
    default:
      return { success: false, error: `Unsupported EMAIL_DELIVERY_MODE.` };
  }
}

async function claimEmailOutbox(
  admin: NonNullable<ReturnType<typeof createAdminClient>>,
  input: {
    workerToken: string;
    limit: number;
    id?: string;
  },
): Promise<ClaimedEmailOutboxItem[]> {
  const { data, error } = await admin.rpc("claim_email_outbox", {
    target_worker_token: input.workerToken,
    target_limit: Math.min(100, Math.max(1, input.limit)),
    target_id: input.id ?? null,
  });
  if (error) {
    console.error("[claimEmailOutbox]", error.message);
    return [];
  }
  return (data as ClaimedEmailOutboxItem[] | null) ?? [];
}

async function completeEmailOutboxClaim(
  admin: NonNullable<ReturnType<typeof createAdminClient>>,
  item: ClaimedEmailOutboxItem,
  workerToken: string,
  result: SendEmailResult,
): Promise<void> {
  const canRetry = !result.success
    && result.retryable !== false
    && item.attempt_count < MAX_QUEUE_ATTEMPTS;
  const retryDelayMinutes = Math.min(360, 5 * (2 ** Math.max(0, item.attempt_count - 1)));
  const { error } = await admin
    .from("email_outbox")
    .update({
      status: result.success ? "sent" : "failed",
      error_message: result.success ? null : result.error ?? "Email send failed.",
      sent_at: result.success ? new Date().toISOString() : null,
      next_attempt_at: canRetry
        ? new Date(Date.now() + retryDelayMinutes * 60_000).toISOString()
        : null,
      retryable: canRetry,
      provider_message_id: result.providerMessageId ?? null,
      claimed_at: null,
      claim_token: null,
    })
    .eq("id", item.id)
    .eq("claim_token", workerToken);
  if (error) console.error("[completeEmailOutboxClaim]", error.message);
}

export async function sendEmailOutboxItem(
  item: Pick<EmailOutboxItem, "id" | "recipient_email" | "subject" | "body">
): Promise<SendEmailResult> {
  if (isDemoMode() || !isEmailDeliveryEnabled()) {
    return { success: true, skipped: true };
  }
  const admin = createAdminClient();
  if (!admin) {
    return {
      success: false,
      error: "Email queue storage is unavailable.",
      retryable: true,
    };
  }
  const workerToken = randomUUID();
  const [claimed] = await claimEmailOutbox(admin, {
    workerToken,
    limit: 1,
    id: item.id,
  });
  if (!claimed) {
    return { success: true, skipped: true };
  }

  const result = await sendEmail({
    to: claimed.recipient_email,
    subject: claimed.subject,
    body: claimed.body,
    idempotencyKey: `stormhub-email-${claimed.id}`,
  });
  await completeEmailOutboxClaim(admin, claimed, workerToken, result);
  return result;
}

export async function processEmailOutbox(limit = 24): Promise<{ attempted: number; sent: number; failed: number }> {
  if (isDemoMode()) return { attempted: 0, sent: 0, failed: 0 };
  if (!isEmailDeliveryEnabled()) return { attempted: 0, sent: 0, failed: 0 };
  const admin = createAdminClient();
  if (!admin) return { attempted: 0, sent: 0, failed: 0 };
  const emailAdmin = admin;

  const workerToken = randomUUID();
  const claimed = await claimEmailOutbox(emailAdmin, { workerToken, limit });

  let sent = 0;
  let failed = 0;
  let cursor = 0;
  async function worker() {
    while (cursor < claimed.length) {
      const item = claimed[cursor];
      cursor += 1;
      const result = await sendEmail({
        to: item.recipient_email,
        subject: item.subject,
        body: item.body,
        idempotencyKey: `stormhub-email-${item.id}`,
      });
      await completeEmailOutboxClaim(emailAdmin, item, workerToken, result);
      if (result.success) sent += 1;
      else failed += 1;
    }
  }
  await Promise.all(
    Array.from(
      { length: Math.min(OUTBOX_CONCURRENCY, claimed.length) },
      () => worker(),
    ),
  );

  return { attempted: claimed.length, sent, failed };
}
