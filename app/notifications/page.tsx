import { PageHeader } from "@/components/layout/page-header";
import { NotificationList } from "@/components/notifications/notification-list";
import { requireAuth } from "@/lib/auth";
import { getUserNotifications } from "@/lib/notifications";

export default async function NotificationsPage() {
  const { userId } = await requireAuth("/notifications");
  const notifications = await getUserNotifications(userId);
  return (
    <div className="container mx-auto max-w-3xl px-4 py-8">
      <PageHeader
        title="Notifications"
        description="Club updates and important StormHub messages."
      />
      <NotificationList notifications={notifications} />
    </div>
  );
}
