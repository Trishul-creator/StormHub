import { FlaskConical } from "lucide-react";

export function DemoEnvironmentBanner() {
  return (
    <div
      role="status"
      className="border-b border-amber-300 bg-amber-100 px-4 py-2 text-center text-sm font-semibold text-amber-950 dark:border-amber-700 dark:bg-amber-950 dark:text-amber-100"
    >
      <span className="inline-flex items-center justify-center gap-2">
        <FlaskConical className="h-4 w-4 shrink-0" aria-hidden="true" />
        DEMONSTRATION ENVIRONMENT — All users and data shown are fictional. This is not an official Elkhorn Public Schools deployment.
      </span>
    </div>
  );
}
