type EnvLike = Record<string, string | undefined>;

export function isStagingE2E(env: EnvLike = process.env): boolean {
  return env.E2E_ENVIRONMENT === "staging";
}

export function allowsMutatingE2E(env: EnvLike = process.env): boolean {
  return isStagingE2E(env) && env.E2E_ALLOW_MUTATIONS === "true";
}

export function hasSafeE2EEmailMode(env: EnvLike = process.env): boolean {
  return env.EMAIL_DELIVERY_MODE === "outbox_only";
}

export function mutationSafetyMessage(): string {
  return "Mutating E2E requires E2E_ENVIRONMENT=staging and E2E_ALLOW_MUTATIONS=true.";
}

export function emailSafetyMessage(): string {
  return "Email E2E requires EMAIL_DELIVERY_MODE=outbox_only so no real email is sent.";
}

export function assertMutatingE2ESafe(env: EnvLike = process.env): void {
  if (!allowsMutatingE2E(env)) {
    throw new Error(mutationSafetyMessage());
  }
}

export function assertEmailE2ESafe(env: EnvLike = process.env): void {
  if (!hasSafeE2EEmailMode(env)) {
    throw new Error(emailSafetyMessage());
  }
}
