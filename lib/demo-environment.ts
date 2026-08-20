const PRODUCTION_SUPABASE_PROJECT_REF = "wtdviuwwvoouypybutod";

type DemoEnvironment = Record<string, string | undefined>;

function clean(value: string | undefined): string | undefined {
  const trimmed = value?.trim();
  return trimmed || undefined;
}

export function supabaseProjectRef(urlValue: string | undefined): string | null {
  const value = clean(urlValue);
  if (!value) return null;
  try {
    const url = new URL(value);
    if (url.hostname === "127.0.0.1" || url.hostname === "localhost") return "local";
    const match = url.hostname.match(/^([a-z0-9-]+)\.supabase\.co$/i);
    return match?.[1]?.toLowerCase() ?? null;
  } catch {
    return null;
  }
}

export function isElkhornDemoDeployment(env: DemoEnvironment = process.env): boolean {
  if (clean(env.STORMHUB_DEMO_MODE)?.toLowerCase() !== "true") return false;
  if (clean(env.VERCEL_ENV)?.toLowerCase() === "production") return false;
  if (clean(env.NODE_ENV)?.toLowerCase() === "production" && clean(env.VERCEL_ENV) !== "preview") {
    return false;
  }
  const ref = supabaseProjectRef(
    env.NEXT_PUBLIC_SUPABASE_URL
      ?? env.STAGING_NEXT_PUBLIC_SUPABASE_URL
      ?? env.STAGING_SUPABASE_URL
  );
  return ref !== PRODUCTION_SUPABASE_PROJECT_REF;
}

export function assertElkhornDemoSeedEnvironment(env: DemoEnvironment = process.env): {
  projectRef: string;
  password: string;
} {
  if (clean(env.STORMHUB_DEMO_MODE)?.toLowerCase() !== "true") {
    throw new Error("Refusing demo data mutation unless STORMHUB_DEMO_MODE=true.");
  }
  if (clean(env.ALLOW_ELKHORN_DEMO_SEED) !== "ELKHORN_DEMO_CONFIRMED") {
    throw new Error(
      "Refusing demo data mutation unless ALLOW_ELKHORN_DEMO_SEED=ELKHORN_DEMO_CONFIRMED."
    );
  }
  if (clean(env.VERCEL_ENV)?.toLowerCase() === "production") {
    throw new Error("Refusing demo data mutation while VERCEL_ENV=production.");
  }
  if (clean(env.NODE_ENV)?.toLowerCase() === "production") {
    throw new Error("Refusing demo data mutation while NODE_ENV=production.");
  }

  const url = clean(
    env.NEXT_PUBLIC_SUPABASE_URL
      ?? env.STAGING_NEXT_PUBLIC_SUPABASE_URL
      ?? env.STAGING_SUPABASE_URL
  );
  const projectRef = supabaseProjectRef(url);
  if (!url || !projectRef) {
    throw new Error("A valid Supabase URL is required for the demo environment.");
  }
  if (projectRef === PRODUCTION_SUPABASE_PROJECT_REF) {
    throw new Error("Refusing to seed the documented StormHub production Supabase project.");
  }

  if (projectRef !== "local") {
    const declaredTarget = clean(env.STORMHUB_DEMO_TARGET)?.toLowerCase();
    if (!declaredTarget || !["preview", "staging", "branch"].includes(declaredTarget)) {
      throw new Error(
        "Hosted demo seeds require STORMHUB_DEMO_TARGET=preview, staging, or branch."
      );
    }
    const confirmedProjectRef = clean(env.DEMO_SUPABASE_PROJECT_REF)?.toLowerCase();
    if (confirmedProjectRef !== projectRef) {
      throw new Error(
        "DEMO_SUPABASE_PROJECT_REF must exactly match the configured nonproduction Supabase URL."
      );
    }
  }

  const password = clean(env.DEMO_ACCOUNT_PASSWORD);
  if (
    !password
    || password.length < 16
    || !/[a-z]/.test(password)
    || !/[A-Z]/.test(password)
    || !/[0-9]/.test(password)
    || !/[^A-Za-z0-9]/.test(password)
  ) {
    throw new Error(
      "DEMO_ACCOUNT_PASSWORD must contain at least 16 characters with upper, lower, number, and symbol."
    );
  }

  return { projectRef, password };
}

export const ELKHORN_DEMO_PRODUCTION_PROJECT_REF = PRODUCTION_SUPABASE_PROJECT_REF;
