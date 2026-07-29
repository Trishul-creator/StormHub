import { AdminNavigation } from "@/components/admin/admin-navigation";
import { requireAdmin } from "@/lib/auth";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const { profile } = await requireAdmin();

  return (
    <>
      <AdminNavigation role={profile.role} />
      {children}
    </>
  );
}
