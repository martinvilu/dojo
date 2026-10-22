"use client";

import { useEffect } from "react";

/**
 * Asks the browser to confirm before closing or reloading the tab while
 * `when` is true (mejora 1.49). Browsers show their own generic message;
 * custom text is no longer honored.
 */
export function useBeforeUnload(when: boolean): void {
  useEffect(() => {
    if (!when) return;
    const handler = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      // Legacy browsers only prompt when returnValue is set.
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [when]);
}
