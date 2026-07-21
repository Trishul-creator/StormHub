"use client";

import { useEffect } from "react";
import { AlertTriangle, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function ErrorPage({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error(JSON.stringify({ level: "error", event: "route_render_failed", digest: error.digest }));
  }, [error]);

  return (
    <div className="mx-auto flex min-h-[60vh] max-w-lg flex-col items-center justify-center px-4 text-center">
      <AlertTriangle className="mb-4 h-10 w-10 text-amber-600" />
      <h1 className="text-2xl font-semibold text-storm-navy">This page could not load</h1>
      <p className="mt-2 text-sm text-muted-foreground">Your data was not changed. Try the page again, or return later if the service is unavailable.</p>
      <Button onClick={reset} className="mt-5"><RotateCcw className="h-4 w-4" /> Try again</Button>
    </div>
  );
}
