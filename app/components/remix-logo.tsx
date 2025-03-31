import { useEffect, useRef, useState } from "react";
import { clsx } from "clsx";

interface RemixLogoProps {
  animateOnScroll?: boolean;
  className?: string;
}

export function RemixLogo({
  animateOnScroll = false,
  className = "",
}: RemixLogoProps) {
  const logoState = useLogoState(animateOnScroll);

  const letterCss = clsx(
    "transform transition-all duration-300 ease-in-out",
    animateOnScroll && logoState === "partial"
      ? "translate-y-[-200px] opacity-0"
      : "translate-y-[0px] opacity-100",
  );

  return (
    <svg
      width="140px"
      height="36px"
      viewBox="0 0 700 180"
      fill="none"
      className={className}
    >
      <path
        className={clsx("fill-red-brand", letterCss)}
        d="M696.11,51.95h-46.39l-21.11,29.44-20.56-29.44h-49.73l44.73,60.82-48.62,63.04h46.39l24.72-33.61,24.72,33.61h49.73l-48.89-64.99,45-58.88Z"
      />
      <path
        className={clsx("fill-green-brand", letterCss)}
        d="M244.89,131.66c-4.17,9.72-11.95,13.89-24.17,13.89-13.61,0-24.72-7.22-25.84-22.5h86.95v-12.5c0-33.61-21.95-61.93-63.34-61.93-38.61,0-67.51,28.05-67.51,67.21s28.34,63.32,68.06,63.32c32.78,0,55.56-15.83,61.95-44.16l-36.11-3.33ZM195.44,101.39c1.67-11.66,8.06-20.55,22.5-20.55,13.33,0,20.56,9.44,21.11,20.55h-43.62Z"
      />
      <path
        className={clsx("fill-yellow-brand", letterCss)}
        d="M410.33,73.06c-5.28-14.44-16.67-24.44-38.62-24.44-18.61,0-31.95,8.33-38.61,21.94v-18.61h-45v123.87h45v-60.82c0-18.61,5.28-30.83,20-30.83,13.61,0,16.95,8.89,16.95,25.83v65.82h45v-60.82c0-18.61,5-30.83,20-30.83,13.61,0,16.67,8.89,16.67,25.83v65.82h45v-77.76c0-25.83-10-49.44-44.17-49.44-20.83,0-35.56,10.55-42.23,24.44Z"
      />
      <path
        className={clsx("fill-pink-brand", letterCss)}
        d="M504.93,51.95v123.87h45V51.95h-45ZM504.65,40.29h45.56V.85h-45.56v39.44Z"
      />
      <path
        className={clsx(
          "transition-color transform duration-300 ease-in-out",
          animateOnScroll && logoState === "partial"
            ? "fill-white"
            : "fill-blue-brand",
        )}
        d="M145.12,135.55c1.57,20.18,1.57,29.64,1.57,39.97h-46.7c0-2.25.04-4.31.08-6.39.13-6.49.26-13.25-.79-26.91-1.39-20-10-24.44-25.84-24.44H0v-36.38h75.67c20,0,30-6.08,30-22.19,0-14.16-10-22.75-30-22.75H0V.85h84c45.28,0,67.78,21.39,67.78,55.55,0,25.55-15.83,42.21-37.23,44.99,18.06,3.61,28.61,13.89,30.56,34.16ZM0,175.52v-28.08h49.38c8.25,0,10.04,7.07,10.04,10.72v17.36H0Z"
      />
    </svg>
  );
}

// Custom hook for how much of the logo is shown based on scroll position
function useLogoState(enableAnimation: boolean) {
  // Start in partial state, as it shows the whole logo
  const [logoState, setLogoState] = useState<"partial" | "full">("partial");
  const lastScrollY = useRef(0);

  useEffect(() => {
    if (!enableAnimation) return;

    // Set the last scroll position after the first render
    lastScrollY.current = window.scrollY;

    let throttleTimeout: NodeJS.Timeout | null = null;

    const throttle = (callback: () => void, delay: number) => {
      if (throttleTimeout !== null) return;

      throttleTimeout = setTimeout(() => {
        callback();
        throttleTimeout = null;
      }, delay);
    };

    const handleScroll = () => {
      throttle(() => {
        const currentScrollY = window.scrollY;

        let scrollOffset = 20;
        if (currentScrollY > lastScrollY.current + scrollOffset) {
          setLogoState("full");
        } else if (currentScrollY < lastScrollY.current - scrollOffset) {
          setLogoState("partial");
        }

        lastScrollY.current = currentScrollY;
      }, 100);
    };

    window.addEventListener("scroll", handleScroll, { passive: true });

    return () => {
      window.removeEventListener("scroll", handleScroll);
      if (throttleTimeout) {
        clearTimeout(throttleTimeout);
      }
    };
  }, [enableAnimation]);

  return logoState;
}
