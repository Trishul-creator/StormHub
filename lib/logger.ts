type LogLevel = "info" | "warn" | "error";

type LogDetails = Record<string, unknown>;

export function logEvent(level: LogLevel, event: string, details: LogDetails = {}): void {
  const payload = JSON.stringify({
    level,
    event,
    timestamp: new Date().toISOString(),
    ...sanitize(details),
  });
  if (level === "error") console.error(payload);
  else if (level === "warn") console.warn(payload);
  else console.info(payload);
}

function sanitize(details: LogDetails): LogDetails {
  const blocked = new Set(["email", "name", "password", "token", "secret", "message", "body"]);
  return Object.fromEntries(
    Object.entries(details)
      .filter(([key]) => !blocked.has(key.toLowerCase()))
      .map(([key, value]) => [key, value instanceof Error ? value.message : value])
  );
}
