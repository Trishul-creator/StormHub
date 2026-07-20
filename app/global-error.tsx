"use client";

import { useEffect } from "react";

export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error(JSON.stringify({ level: "error", event: "global_render_failed", digest: error.digest }));
  }, [error]);

  return (
    <html lang="en">
      <body>
        <main style={{ fontFamily: "system-ui, sans-serif", maxWidth: 560, margin: "15vh auto", padding: 24, textAlign: "center" }}>
          <h1>StormHub is temporarily unavailable</h1>
          <p>Reload the application. If this continues, contact school support.</p>
          <button type="button" onClick={reset} style={{ padding: "10px 16px", cursor: "pointer" }}>Reload StormHub</button>
        </main>
      </body>
    </html>
  );
}
