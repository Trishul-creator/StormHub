"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { CheckCheck } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { markAllNotificationsRead, markNotificationRead } from "@/lib/actions";
import type { Notification } from "@/types/database";
import { humanizeLabel } from "@/lib/utils";

export function NotificationList({ notifications }: { notifications: Notification[] }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const unread = notifications.filter((notification) => !notification.read_at).length;

  if (notifications.length === 0) {
    return (
      <div className="rounded-xl border border-dashed bg-white p-12 text-center text-muted-foreground">
        No notifications yet. Club updates will appear here.
      </div>
    );
  }

  return (
    <div>
      {unread > 0 && (
        <div className="mb-4 flex justify-end">
          <Button
            variant="outline"
            size="sm"
            disabled={pending}
            onClick={() => startTransition(async () => {
              await markAllNotificationsRead();
              router.refresh();
            })}
          >
            <CheckCheck className="h-4 w-4" /> Mark all as read
          </Button>
        </div>
      )}
      <div className="space-y-3">
        {notifications.map((notification) => (
          <button
            key={notification.id}
            onClick={() => startTransition(async () => {
              if (!notification.read_at) await markNotificationRead(notification.id);
              router.push(notification.link || "/notifications");
              router.refresh();
            })}
            className={`block w-full rounded-xl border p-4 text-left transition hover:border-storm-electric/40 hover:shadow-sm ${
              notification.read_at ? "bg-white" : "bg-blue-50/60"
            }`}
          >
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div>
                <p className="font-semibold text-storm-navy">{notification.title}</p>
                <p className="mt-1 text-sm text-muted-foreground">{notification.message}</p>
              </div>
              {notification.importance !== "normal" && (
                <Badge variant={notification.importance === "urgent" ? "destructive" : "warning"}>
                  {humanizeLabel(notification.importance)}
                </Badge>
              )}
            </div>
            <p className="mt-3 text-xs text-muted-foreground">
              {notification.club?.name ? `${notification.club.name} · ` : ""}
              {formatDistanceToNow(new Date(notification.created_at), { addSuffix: true })}
            </p>
          </button>
        ))}
      </div>
    </div>
  );
}
