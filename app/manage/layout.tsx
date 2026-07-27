import { ManagementNavigation } from "@/components/manage/management-navigation";
import { requireManager } from "@/lib/auth";
import { canApproveContent } from "@/lib/permissions";

export default async function ManageLayout({ children }: { children: React.ReactNode }) {
  const { profile } = await requireManager();

  return (
    <>
      <ManagementNavigation
        role={profile.role}
        canApprove={canApproveContent(profile)}
      />
      {children}
    </>
  );
}
