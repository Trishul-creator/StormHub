"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, ShieldAlert } from "lucide-react";

const MAX_BROWSER_TIMEOUT_MS = 2_147_000_000;

export function PlatformSupportExpiryGuard({
  expiresAt,
  returnTo,
}: {
  expiresAt: string;
  returnTo: string;
}) {
  const router = useRouter();
  const [expired, setExpired] = useState(false);

  useEffect(() => {
    const expire = () => {
      setExpired(true);
      router.replace(returnTo);
      router.refresh();
    };
    let expiryTimer: number | undefined;
    const checkExpiry = () => {
      const remaining = new Date(expiresAt).getTime() - Date.now();
      if (remaining <= 0) {
        expire();
        return;
      }
      expiryTimer = window.setTimeout(
        checkExpiry,
        Math.min(remaining, MAX_BROWSER_TIMEOUT_MS)
      );
    };
    checkExpiry();
    const refreshTimer = window.setInterval(() => router.refresh(), 30_000);
    return () => {
      if (expiryTimer !== undefined) window.clearTimeout(expiryTimer);
      window.clearInterval(refreshTimer);
    };
  }, [expiresAt, returnTo, router]);

  if (!expired) return null;

  return (
    <div className="fixed inset-0 z-[100] grid place-items-center bg-background/95 p-6 backdrop-blur-sm">
      <div className="max-w-md rounded-2xl border bg-card p-6 text-center shadow-xl" role="status">
        <ShieldAlert className="mx-auto h-8 w-8 text-amber-600 dark:text-amber-300" />
        <h2 className="mt-3 text-lg font-semibold text-foreground">Support access ended</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          Private school information has been locked. Returning to the scoped support workspace.
        </p>
        <Loader2 className="mx-auto mt-4 h-5 w-5 animate-spin text-storm-electric" />
      </div>
    </div>
  );
}
