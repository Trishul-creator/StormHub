import Link from "next/link";
import { PageHeader } from "@/components/layout/page-header";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { requireAdmin } from "@/lib/auth";
import { Users, School, FileText, BarChart3 } from "lucide-react";

const adminLinks = [
  { href: "/admin/users", icon: Users, title: "Users & Roles", description: "Manage student and staff accounts" },
  { href: "/admin/schools", icon: School, title: "Schools", description: "School configuration (single-school for now)" },
  { href: "/admin/content", icon: FileText, title: "Content Moderation", description: "Global approval queue" },
  { href: "/manage/analytics", icon: BarChart3, title: "Analytics", description: "Platform-wide metrics" },
];

export default async function AdminPage() {
  await requireAdmin();

  return (
    <div className="container mx-auto px-4 py-8">
      <PageHeader title="Admin Panel" description="School-wide administration for StormHub." />
      <div className="grid gap-4 sm:grid-cols-2">
        {adminLinks.map((link) => (
          <Link key={link.href} href={link.href}>
            <Card className="h-full hover:shadow-md transition-shadow">
              <CardHeader>
                <link.icon className="h-6 w-6 text-storm-electric mb-2" />
                <CardTitle>{link.title}</CardTitle>
                <CardDescription>{link.description}</CardDescription>
              </CardHeader>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
}
