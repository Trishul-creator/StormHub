import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";
import { isDemoMode } from "@/lib/supabase/mode";
import type { EmailOutboxItem } from "@/types/database";

interface SendEmailInput {
  to: string;
  subject: string;
  body: string;
}

interface SendEmailResult {
  success: boolean;
  error?: string;
}

const deliveryMode = () =>
  process.env.EMAIL_DELIVERY_MODE?.trim().toLowerCase() ||
  process.env.EMAIL_PROVIDER?.trim().toLowerCase() ||
  (process.env.RESEND_API_KEY ? "resend" : "in_app_only");

export function isEmailDeliveryEnabled(): boolean {
  return deliveryMode() === "resend";
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

async function sendWithResend(input: SendEmailInput): Promise<SendEmailResult> {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.EMAIL_FROM;
  if (!apiKey || !from) {
    return { success: false, error: "Missing RESEND_API_KEY or EMAIL_FROM." };
  }

  const text = withAbsoluteLinks(input.body);
  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
      "User-Agent": "stormhub/1.0",
    },
    body: JSON.stringify({
      from,
      to: [input.to],
      subject: input.subject,
      text,
      html: toHtml(text),
    }),
  });

  if (response.ok) return { success: true };

  let error = `Resend request failed with ${response.status}.`;
  try {
    const payload = await response.json();
    error = payload?.message || payload?.error || JSON.stringify(payload);
  } catch {
    const textError = await response.text().catch(() => "");
    if (textError) error = textError;
  }
  return { success: false, error };
}

export async function sendEmail(input: SendEmailInput): Promise<SendEmailResult> {
  if (isDemoMode()) return { success: true };

  switch (deliveryMode()) {
    case "resend":
      return sendWithResend(input);
    case "disabled":
    case "none":
    case "in_app_only":
    case "":
      return { success: true };
    default:
      return { success: false, error: `Unsupported EMAIL_DELIVERY_MODE: ${deliveryMode()}.` };
  }
}

export async function updateEmailOutboxStatus(id: string, result: SendEmailResult): Promise<void> {
  const admin = createAdminClient();
  if (!admin) return;
  const { error } = await admin
    .from("email_outbox")
    .update({
      status: result.success ? "sent" : "failed",
      error_message: result.success ? null : result.error ?? "Email send failed.",
      sent_at: result.success ? new Date().toISOString() : null,
    })
    .eq("id", id);
  if (error) console.error("[updateEmailOutboxStatus]", error.message);
}

export async function sendEmailOutboxItem(
  item: Pick<EmailOutboxItem, "id" | "recipient_email" | "subject" | "body">
): Promise<SendEmailResult> {
  const result = await sendEmail({
    to: item.recipient_email,
    subject: item.subject,
    body: item.body,
  });
  await updateEmailOutboxStatus(item.id, result);
  return result;
}

export async function processEmailOutbox(limit = 50): Promise<{ attempted: number; sent: number; failed: number }> {
  if (isDemoMode()) return { attempted: 0, sent: 0, failed: 0 };
  if (!isEmailDeliveryEnabled()) return { attempted: 0, sent: 0, failed: 0 };
  const admin = createAdminClient();
  if (!admin) return { attempted: 0, sent: 0, failed: 0 };

  const { data, error } = await admin
    .from("email_outbox")
    .select("id,recipient_email,subject,body")
    .in("status", ["pending", "failed"])
    .order("created_at", { ascending: true })
    .limit(limit);

  if (error) {
    console.error("[processEmailOutbox]", error.message);
    return { attempted: 0, sent: 0, failed: 0 };
  }

  let sent = 0;
  let failed = 0;
  for (const item of data ?? []) {
    const result = await sendEmailOutboxItem(
      item as Pick<EmailOutboxItem, "id" | "recipient_email" | "subject" | "body">
    );
    if (result.success) sent += 1;
    else failed += 1;
  }

  return { attempted: data?.length ?? 0, sent, failed };
}
