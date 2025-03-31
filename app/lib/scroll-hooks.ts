import { useState } from "react";
import { usePrefersReducedMotion } from "~/lib/hooks";
import { useLayoutEffect } from "~/lib/use-layout-effect";

/**
 * Hook that calculates what percentage of an element has been scrolled past
 * Respects prefers-reduced-motion setting
 * @param ref - React ref to the element to measure
 * @returns A number between 0 and 1 representing the percentage scrolled past
 */
export function useScrollPercentage(ref: React.RefObject<HTMLElement>) {
  let [scrollPercentage, setScrollPercentage] = useState(0);
  let prefersReducedMotion = usePrefersReducedMotion();

  useLayoutEffect(() => {
    // If user prefers reduced motion, don't update scroll percentage
    if (prefersReducedMotion) return;

    let rafId: number;

    let calculateVisibility = () => {
      rafId = requestAnimationFrame(() => {
        if (!ref.current) return;

        const height = ref.current.offsetHeight;
        const rect = ref.current.getBoundingClientRect();
        const scrollY = window.scrollY;
        const elementTop = scrollY + rect.top;

        // If we've scrolled past the element, it's 0% visible
        if (scrollY >= elementTop + height) {
          return;
        }

        let percentage =
          1 -
          Math.max(0, Math.min(1, (elementTop + height - scrollY) / height));
        setScrollPercentage(percentage);
      });
    };

    // Calculate initial visibility
    calculateVisibility();

    // Set up scroll listener
    window.addEventListener("scroll", calculateVisibility, { passive: true });
    // Only need resize if window height affects calculations
    window.addEventListener("resize", calculateVisibility);

    return () => {
      window.removeEventListener("scroll", calculateVisibility);
      window.removeEventListener("resize", calculateVisibility);
      cancelAnimationFrame(rafId);
    };
  }, [ref, prefersReducedMotion]);

  return scrollPercentage;
}
