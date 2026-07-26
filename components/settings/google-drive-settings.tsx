"use client";

import { useState } from "react";
import { CheckCircle2, Cloud, Loader2, Unplug } from "lucide-react";
import { Button } from "@/components/ui/button";
import { disconnectGoogleDriveAction } from "@/lib/actions";
import { toast } from "@/hooks/use-toast";
import { useRouter } from "next/navigation";
import type { GoogleDriveConnectionStatus } from "@/types/database";

export function GoogleDriveSettings({
  status,
}: {
  status: GoogleDriveConnectionStatus;
}) {
  const router = useRouter();
  const [disconnecting, setDisconnecting] = useState(false);

  async function disconnect() {
    setDisconnecting(true);
    const result = await disconnectGoogleDriveAction();
    setDisconnecting(false);
    if (!result.success) {
      toast({ title: "Could not disconnect Google Drive", description: result.error, variant: "destructive" });
      return;
    }
    toast({ title: "Google Drive disconnected" });
    router.refresh();
  }

  return (
    <div className="flex flex-col gap-4 rounded-xl border bg-muted/20 p-4 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex min-w-0 gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-blue-100 text-storm-electric">
          <Cloud className="h-5 w-5" />
        </div>
        <div className="min-w-0">
          <p className="flex items-center gap-2 font-medium text-storm-navy">
            Google Drive
            {status.connected && <CheckCircle2 className="h-4 w-4 text-emerald-700" aria-label="Connected" />}
          </p>
          <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
            {status.connected
              ? `Connected${status.google_email ? ` as ${status.google_email}` : ""}. Choose Drive files without giving StormHub access to your entire Drive.`
              : status.configured
                ? "Connect Drive to attach selected files and create or receive private assignment copies."
                : "An administrator must finish the Google Cloud credentials before Drive can be connected."}
          </p>
        </div>
      </div>
      {status.connected ? (
        <Button variant="outline" onClick={disconnect} disabled={disconnecting} className="shrink-0">
          {disconnecting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Unplug className="h-4 w-4" />}
          {disconnecting ? "Disconnecting..." : "Disconnect"}
        </Button>
      ) : status.configured ? (
          <Button asChild className="shrink-0">
            <a href="/api/integrations/google-drive/connect?returnTo=%2Fsettings%23integrations">
              <Cloud className="h-4 w-4" /> Connect Drive
            </a>
          </Button>
        ) : (
          <Button disabled className="shrink-0">
            <Cloud className="h-4 w-4" /> Connect Drive
          </Button>
        )}
    </div>
  );
}
