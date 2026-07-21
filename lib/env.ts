type Env = Record<string, string | undefined>;

function clean(value: string | undefined): string | undefined {
  const trimmed = value?.trim();
  return trimmed ? trimmed : undefined;
}

export function isStagingEnvironment(env: Env = process.env): boolean {
  return clean(env.E2E_ENVIRONMENT) === "staging" || clean(env.VERCEL_ENV) === "preview";
}

export function isExplicitStagingE2E(env: Env = process.env): boolean {
  return clean(env.E2E_ENVIRONMENT) === "staging";
}

export function getSupabaseUrl(env: Env = process.env): string {
  const value = clean(env.NEXT_PUBLIC_SUPABASE_URL);
  if (value) return value;
  const stagingValue = clean(env.STAGING_NEXT_PUBLIC_SUPABASE_URL) || clean(env.STAGING_SUPABASE_URL);
  if (isExplicitStagingE2E(env) && stagingValue) return stagingValue;
  throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL. For staging E2E, STAGING_NEXT_PUBLIC_SUPABASE_URL is also accepted.");
}

export function getSupabaseAnonKey(env: Env = process.env): string {
  const value = clean(env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
  if (value) return value;
  const stagingValue = clean(env.STAGING_NEXT_PUBLIC_SUPABASE_ANON_KEY) || clean(env.STAGING_SUPABASE_ANON_KEY);
  if (isExplicitStagingE2E(env) && stagingValue) return stagingValue;
  throw new Error(
    "Missing NEXT_PUBLIC_SUPABASE_ANON_KEY. For staging E2E, STAGING_NEXT_PUBLIC_SUPABASE_ANON_KEY is also accepted."
  );
}

export function getSupabaseServiceRoleKey(env: Env = process.env): string {
  const value = clean(env.SUPABASE_SERVICE_ROLE_KEY);
  if (value) return value;
  const stagingValue = clean(env.STAGING_SUPABASE_SERVICE_ROLE_KEY);
  if (isExplicitStagingE2E(env) && stagingValue) return stagingValue;
  throw new Error("Missing SUPABASE_SERVICE_ROLE_KEY. For staging E2E, STAGING_SUPABASE_SERVICE_ROLE_KEY is also accepted.");
}

export function maybeGetSupabaseUrl(env: Env = process.env): string | null {
  try {
    return getSupabaseUrl(env);
  } catch {
    return null;
  }
}

export function maybeGetSupabaseAnonKey(env: Env = process.env): string | null {
  try {
    return getSupabaseAnonKey(env);
  } catch {
    return null;
  }
}

export function maybeGetSupabaseServiceRoleKey(env: Env = process.env): string | null {
  try {
    return getSupabaseServiceRoleKey(env);
  } catch {
    return null;
  }
}

export function getEmailDeliveryMode(env: Env = process.env): "disabled" | "outbox_only" | "send" {
  const mode =
    clean(env.EMAIL_DELIVERY_MODE)?.toLowerCase() ||
    clean(env.EMAIL_PROVIDER)?.toLowerCase() ||
    (clean(env.RESEND_API_KEY) ? "send" : "outbox_only");

  if (mode === "disabled" || mode === "none" || mode === "in_app_only") return "disabled";
  if (isExplicitStagingE2E(env)) return "outbox_only";
  if (mode === "send" || mode === "resend") return "send";
  return "outbox_only";
}

export function isAssistantEnabled(env: Env = process.env): boolean {
  const aiEnabled = clean(env.AI_FEATURES_ENABLED)?.toLowerCase();
  const groqEnabled = clean(env.GROQ_ENABLED)?.toLowerCase();
  const dataSharingApproved = clean(env.AI_DATA_SHARING_APPROVED)?.toLowerCase();
  if (aiEnabled !== "true" || groqEnabled !== "true" || dataSharingApproved !== "true") return false;
  if (isExplicitStagingE2E(env)) return false;
  return Boolean(clean(env.GROQ_API_KEY));
}

export function isCaptchaEnabled(env: Env = process.env): boolean {
  return Boolean(clean(env.NEXT_PUBLIC_HCAPTCHA_SITE_KEY) && clean(env.HCAPTCHA_SECRET_KEY));
}

export function getHcaptchaSecret(env: Env = process.env): string | null {
  return clean(env.HCAPTCHA_SECRET_KEY) ?? null;
}

export function getPublicSiteUrl(env: Env = process.env): string {
  return clean(env.NEXT_PUBLIC_SITE_URL) ?? "https://stormhubapp.com";
}

export function getGroqApiKey(env: Env = process.env): string | null {
  if (!isAssistantEnabled(env)) return null;
  return clean(env.GROQ_API_KEY) ?? null;
}

export function getGroqModel(env: Env = process.env): string {
  return clean(env.GROQ_MODEL) ?? "openai/gpt-oss-20b";
}
