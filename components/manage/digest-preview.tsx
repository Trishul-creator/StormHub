"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { formatDate } from "@/lib/utils";
import type { Club, ClubAnnouncement, Event, Opportunity } from "@/types/database";
import { Copy, Check } from "lucide-react";

interface DigestPreviewProps {
  opportunities: Opportunity[];
  events: Event[];
  clubs: Club[];
  announcements: (ClubAnnouncement & { club?: Club })[];
  schoolName: string;
}

export function DigestPreview({ opportunities, events, clubs, announcements, schoolName }: DigestPreviewProps) {
  const [copied, setCopied] = useState(false);

  const digest = `STORMHUB WEEKLY DIGEST — ${schoolName}
Generated: ${formatDate(new Date())}

📌 NEW OPPORTUNITIES
${opportunities.slice(0, 5).map((o) => `• ${o.title}${o.deadline ? ` (Deadline: ${formatDate(o.deadline)})` : ""}`).join("\n")}

📣 CLUB ANNOUNCEMENTS
${announcements.slice(0, 5).map((a) => `• ${a.club?.name ? `${a.club.name}: ` : ""}${a.title}`).join("\n")}

📅 UPCOMING EVENTS
${events.slice(0, 5).map((e) => `• ${e.title} — ${formatDate(e.starts_at)}`).join("\n")}

⭐ FEATURED CLUBS
${clubs.map((c) => `• ${c.name}: ${c.short_description}`).join("\n")}

Discover more at StormHub — your student opportunity hub.
`;

  async function handleCopy() {
    await navigator.clipboard.writeText(digest);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div>
      <div className="mb-4 flex justify-end">
        <Button onClick={handleCopy} variant="outline" size="sm">
          {copied ? <><Check className="h-4 w-4 mr-1" /> Copied!</> : <><Copy className="h-4 w-4 mr-1" /> Copy digest</>}
        </Button>
      </div>
      <pre className="rounded-xl border bg-storm-light/30 p-6 text-sm whitespace-pre-wrap font-mono leading-relaxed">
        {digest}
      </pre>
    </div>
  );
}
