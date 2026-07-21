import Link from "next/link";
import { SearchX } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function NotFoundPage() {
  return (
    <div className="mx-auto flex min-h-[60vh] max-w-lg flex-col items-center justify-center px-4 text-center">
      <SearchX className="mb-4 h-10 w-10 text-storm-silver" />
      <h1 className="text-2xl font-semibold text-storm-navy">Page not found</h1>
      <p className="mt-2 text-sm text-muted-foreground">The link may be outdated, or the content may no longer be published.</p>
      <div className="mt-5 flex gap-2">
        <Button asChild><Link href="/dashboard">Dashboard</Link></Button>
        <Button variant="outline" asChild><Link href="/search">Search</Link></Button>
      </div>
    </div>
  );
}
