import Link from "next/link";
import { Zap, Users, Calendar, FileText, Bell, TrendingUp } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";

const features = [
  { icon: Users, title: "Discover clubs", description: "Browse school clubs and activities in one place." },
  { icon: Calendar, title: "Track deadlines", description: "Never miss an audition, competition, or signup date." },
  { icon: Zap, title: "Join activities", description: "One-click club enrollment with member-only access." },
  { icon: FileText, title: "Access resources", description: "Find member resources and club updates without digging through messages." },
  { icon: Bell, title: "Get club updates", description: "See announcements, meeting changes, and reminders." },
  { icon: TrendingUp, title: "Build your path", description: "Discover opportunities that shape your high school experience." },
];

export function FeatureCards() {
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {features.map((f) => (
        <Card key={f.title} className="border-storm-light/50 hover:shadow-md transition-shadow">
          <CardContent className="p-6">
            <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-lg bg-storm-electric/10">
              <f.icon className="h-5 w-5 text-storm-electric" />
            </div>
            <h3 className="font-semibold text-storm-navy">{f.title}</h3>
            <p className="mt-1 text-sm text-muted-foreground">{f.description}</p>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
