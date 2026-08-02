"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { Bell, CheckCheck } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { markAllNotificationsRead, markNotificationRead } from "@/lib/actions";
import type { Notification } from "@/types/database";
import { useRouter } from "next/navigation";
import { humanizeLabel } from "@/lib/utils";
import { useDismissibleLayer } from "@/hooks/use-dismissible-layer";

export function NotificationBell({
  notifications,
  unreadCount,
}: {
  notifications: Notification[];
  unreadCount: number;
}) {
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const router = useRouter();
  const rootRef = useDismissibleLayer<HTMLDivElement>(open, () => setOpen(false));

  function openNotification(notification: Notification) {
    startTransition(async () => {
      if (!notification.read_at) await markNotificationRead(notification.id);
      setOpen(false);
      router.push(notification.link || "/notifications");
      router.refresh();
    });
  }

  return (
    <div ref={rootRef} className="relative">
      <Button
        data-tour="notifications-trigger"
        variant="ghost"
        size="sm"
        onClick={() => setOpen((value) => !value)}
        aria-label={`Notifications${unreadCount ? `, ${unreadCount} unread` : ""}`}
        aria-expanded={open}
        aria-controls="notification-menu"
        className="relative px-2"
      >
        <Bell className="h-4 w-4" />
        {unreadCount > 0 && (
          <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-600 px-1 text-[10px] font-bold text-white">
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        )}
      </Button>

      {open && (
        <div
          id="notification-menu"
          data-tour="notification-panel"
          className="absolute right-0 top-11 z-50 w-[min(22rem,calc(100vw-2rem))] overflow-hidden rounded-xl border bg-popover text-popover-foreground shadow-xl"
        >
          <div className="flex items-center justify-between border-b p-3">
            <div>
              <p className="font-semibold text-storm-navy">Notifications</p>
              <p className="text-xs text-muted-foreground">{unreadCount} unread</p>
            </div>
            {unreadCount > 0 && (
              <button
                disabled={pending}
                onClick={() => startTransition(async () => {
                  await markAllNotificationsRead();
                  router.refresh();
                })}
                className="flex items-center gap-1 text-xs font-medium text-storm-electric hover:underline"
              >
                <CheckCheck className="h-3.5 w-3.5" /> Mark all read
              </button>
            )}
          </div>
          <div className="max-h-96 overflow-y-auto">
            {notifications.length === 0 ? (
              <p className="p-6 text-center text-sm text-muted-foreground">
                No notifications yet. Club updates will appear here.
              </p>
            ) : (
              notifications.map((notification) => (
                <button
                  key={notification.id}
                  onClick={() => openNotification(notification)}
                  className={`block w-full border-b p-3 text-left transition hover:bg-storm-light/30 ${
                    notification.read_at ? "bg-popover" : "bg-blue-50/60 dark:bg-blue-950/35"
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <p className="text-sm font-semibold text-storm-navy">{notification.title}</p>
                    {notification.importance !== "normal" && (
                      <Badge variant={notification.importance === "urgent" ? "destructive" : "warning"}>
                        {humanizeLabel(notification.importance)}
                      </Badge>
                    )}
                  </div>
                  <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">{notification.message}</p>
                  <p className="mt-1.5 text-[11px] text-muted-foreground">
                    {notification.club?.name ? `${notification.club.name} · ` : ""}
                    {formatDistanceToNow(new Date(notification.created_at), { addSuffix: true })}
                  </p>
                </button>
              ))
            )}
          </div>
          <Link
            href="/notifications"
            onClick={() => setOpen(false)}
            className="block p-3 text-center text-sm font-medium text-storm-electric hover:bg-storm-light/30"
          >
            View all notifications
          </Link>
        </div>
      )}
    </div>
  );
}
