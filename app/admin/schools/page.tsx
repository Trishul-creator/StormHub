import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/auth";
import { getDistrictById } from "@/lib/districts";

export default async function AdminSchoolsPage() {
  const { profile } = await requireAdmin();
  if (profile.role === "super_admin") redirect("/admin/districts");
  if (profile.role === "district_admin" && profile.district_id) {
    const district = await getDistrictById(profile.district_id);
    redirect(district ? `/admin/districts/${district.slug}` : "/admin?error=district_not_found");
  }
  redirect("/admin");
}
