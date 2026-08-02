"use client";

import { useEffect, useRef } from "react";

/**
 * Gives custom menus the same dismissal behavior as native/Radix popovers.
 * The trigger and floating content should both live inside the returned root.
 */
export function useDismissibleLayer<T extends HTMLElement>(
  open: boolean,
  onDismiss: () => void
) {
  const rootRef = useRef<T>(null);
  const dismissRef = useRef(onDismiss);

  useEffect(() => {
    dismissRef.current = onDismiss;
  }, [onDismiss]);

  useEffect(() => {
    if (!open) return;

    function handlePointerDown(event: PointerEvent) {
      const target = event.target;
      if (target instanceof Node && !rootRef.current?.contains(target)) {
        dismissRef.current();
      }
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") dismissRef.current();
    }

    document.addEventListener("pointerdown", handlePointerDown, true);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("pointerdown", handlePointerDown, true);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [open]);

  return rootRef;
}
