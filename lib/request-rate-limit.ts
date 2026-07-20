import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";
import { hashSignupIdentifier } from "@/lib/signup-security";

export type RateLimitResult =
  | { allowed: true; attemptId: string | null; remaining: number }
  | { allowed: false; attemptId: null; remaining: 0; error: string };

export async function checkDurableRateLimit(input: {
  requestType: string;
  identity: string;
  maxAttempts: number;
  windowMinutes: number;
}): Promise<RateLimitResult> {
  const admin = createAdminClient();
  const secret =
    process.env.REQUEST_RATE_LIMIT_SECRET?.trim()
    || process.env.SIGNUP_RATE_LIMIT_SECRET?.trim()
    || process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();

  if (!admin || !secret) {
    if (process.env.NODE_ENV !== "production") {
      return { allowed: true, attemptId: null, remaining: input.maxAttempts };
    }
    return {
      allowed: false,
      attemptId: null,
      remaining: 0,
      error: "Request protection is temporarily unavailable.",
    };
  }

  const actorHash = hashSignupIdentifier(input.identity, secret);
  const since = new Date(Date.now() - input.windowMinutes * 60_000).toISOString();
  const { count, error: countError } = await admin
    .from("request_attempts")
    .select("id", { count: "exact", head: true })
    .eq("request_type", input.requestType)
    .eq("actor_hash", actorHash)
    .gte("created_at", since);

  if (countError) {
    return process.env.NODE_ENV === "production"
      ? { allowed: false, attemptId: null, remaining: 0, error: "Request protection is temporarily unavailable." }
      : { allowed: true, attemptId: null, remaining: input.maxAttempts };
  }
  if ((count ?? 0) >= input.maxAttempts) {
    return { allowed: false, attemptId: null, remaining: 0, error: "Too many requests. Please try again later." };
  }

  const { data, error } = await admin
    .from("request_attempts")
    .insert({ request_type: input.requestType, actor_hash: actorHash })
    .select("id")
    .single();
  if (error && process.env.NODE_ENV === "production") {
    return { allowed: false, attemptId: null, remaining: 0, error: "Request protection is temporarily unavailable." };
  }

  return {
    allowed: true,
    attemptId: data?.id ?? null,
    remaining: Math.max(input.maxAttempts - (count ?? 0) - 1, 0),
  };
}

export async function markRateLimitAttemptSuccessful(attemptId: string | null): Promise<void> {
  if (!attemptId) return;
  const admin = createAdminClient();
  if (admin) {
    await admin.from("request_attempts").update({ was_successful: true }).eq("id", attemptId);
  }
}
