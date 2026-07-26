import { Download } from "lucide-react";
import { Button } from "@/components/ui/button";

export function AccountControls() {
  return (
    <Button variant="outline" asChild>
      <a href="/api/account/export"><Download className="h-4 w-4" /> Export my data</a>
    </Button>
  );
}
