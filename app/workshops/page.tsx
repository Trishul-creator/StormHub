import Link from "next/link";
import { Calendar, MapPin, ExternalLink } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { CategoryBadge } from "@/components/ui/badge";
import { EmptyState } from "@/components/layout/empty-state";
import { getWorkshops } from "@/lib/data";
import { formatDateTime } from "@/lib/utils";

export default async function WorkshopsPage() {
  const workshops = await getWorkshops();

  return (
    <div className="container mx-auto px-4 py-8">
      <PageHeader
        title="Workshops & Peer Tutoring"
        description="Student-led workshops and peer tutoring sessions at Elkhorn South."
      >
        <Button asChild>
          <Link href="/workshops/submit">Host a workshop</Link>
        </Button>
      </PageHeader>

      {workshops.length === 0 ? (
        <EmptyState title="No workshops yet" description="Check back soon or submit your own workshop." />
      ) : (
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {workshops.map((w) => (
            <Card key={w.id}>
              <CardHeader>
                <CardTitle className="text-lg">{w.title}</CardTitle>
                {w.subject_area && <CategoryBadge category={w.subject_area} />}
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">{w.description}</p>
                <div className="mt-3 space-y-1 text-xs text-muted-foreground">
                  {w.skill_level && <p>Level: {w.skill_level}</p>}
                  {w.starts_at && (
                    <p className="flex items-center gap-1"><Calendar className="h-3 w-3" />{formatDateTime(w.starts_at)}</p>
                  )}
                  {w.location && (
                    <p className="flex items-center gap-1"><MapPin className="h-3 w-3" />{w.location}</p>
                  )}
                </div>
              </CardContent>
              {w.signup_url && (
                <CardFooter>
                  <Button variant="outline" size="sm" asChild className="w-full">
                    <a href={w.signup_url} target="_blank" rel="noopener noreferrer">
                      Sign up <ExternalLink className="h-3 w-3" />
                    </a>
                  </Button>
                </CardFooter>
              )}
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
