/**
 * A collection of custom hooks, they can get moved out if it becomes unwieldy
 */

import { useEffect, useState } from "react";

function getMediaQuery() {
  if (typeof window === "undefined") return undefined;
  return window.matchMedia("(prefers-reduced-motion: reduce)");
}

export function usePrefersReducedMotion() {
  let [prefersReducedMotion, setPrefersReducedMotion] = useState(() =>
    Boolean(getMediaQuery()?.matches),
  );

  useEffect(() => {
    // Set initial value
    let mediaQuery = getMediaQuery();
    if (!mediaQuery) return;

    // Update state when preference changes
    let handleChange = (event: MediaQueryListEvent) => {
      setPrefersReducedMotion(event.matches);
    };

    // Modern browsers support addEventListener on MediaQueryList
    mediaQuery.addEventListener("change", handleChange);

    return () => {
      mediaQuery.removeEventListener("change", handleChange);
    };
  }, []);

  return prefersReducedMotion;
}
