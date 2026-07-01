import Link from "next/link";
import { Shield, Zap, Users, BarChart3, CheckSquare, Mail } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { requireManager } from "@/lib/auth";
import { getPendingApprovals } from "@/lib/data";
import { canAccessAdmin, canAccessManageAnalytics, canApproveContent } from "@/lib/permissions";

const manageLinks = [
  { href: "/manage/clubs", icon: Users, title: "Manage Clubs", description: "Edit club profiles and view members" },
  { href: "/manage/opportunities", icon: Zap, title: "Opportunities", description: "Post school-wide sign-ups and applications" },
  { href: "/manage/approvals", icon: CheckSquare, title: "Approval Queue", description: "Review pending content" },
  { href: "/manage/analytics", icon: BarChart3, title: "Analytics", description: "View platform metrics" },
  { href: "/manage/digest", icon: Mail, title: "Weekly Digest", description: "Generate newsletter content" },
  { href: "/admin", icon: Shield, title: "Admin Panel", description: "School-wide administration" },
];

export default async function ManagePage() {
  const { profile } = await requireManager();
  const pendingApprovals = canApproveContent(profile) ? await getPendingApprovals() : [];
  const visibleLinks = manageLinks.filter((link) => {
    if (link.href === "/admin") return canAccessAdmin(profile);
    if (link.href === "/manage/opportunities") return canAccessAdmin(profile);
    if (link.href === "/manage/analytics") return canAccessManageAnalytics(profile);
    if (link.href === "/manage/approvals") return canAccessAdmin(profile) || pendingApprovals.length > 0;
    return true;
  });

  return (
    <div className="container mx-auto px-4 py-8">
      <PageHeader
        title="Management"
        description="Manage clubs, content, and approvals. Officer and admin tools."
      />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {visibleLinks.map((link) => (
          <Link key={link.href} href={link.href}>
            <Card className="h-full hover:shadow-md transition-shadow cursor-pointer">
              <CardHeader>
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-storm-electric/10 mb-2">
                  <link.icon className="h-5 w-5 text-storm-electric" />
                </div>
                <CardTitle className="text-lg">{link.title}</CardTitle>
                <CardDescription>{link.description}</CardDescription>
              </CardHeader>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
}
