"use client";

import { type ComponentPropsWithoutRef, useState } from "react";
import { useDismissibleLayer } from "@/hooks/use-dismissible-layer";

type DismissibleDetailsProps = Omit<
  ComponentPropsWithoutRef<"details">,
  "open" | "onClick" | "onToggle"
> & {
  initiallyOpen?: boolean;
};

/** A native details disclosure that also closes on outside click and Escape. */
export function DismissibleDetails({
  initiallyOpen = false,
  children,
  ...props
}: DismissibleDetailsProps) {
  const [open, setOpen] = useState(initiallyOpen);
  const rootRef = useDismissibleLayer<HTMLDetailsElement>(open, () => setOpen(false));

  return (
    <details
      {...props}
      ref={rootRef}
      open={open}
      onClick={(event) => {
        const target = event.target;
        if (!(target instanceof Element)) return;
        const summary = target.closest("summary");
        if (summary?.parentElement !== event.currentTarget) return;
        event.preventDefault();
        setOpen((current) => !current);
      }}
    >
      {children}
    </details>
  );
}
