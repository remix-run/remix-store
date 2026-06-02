import { useEffect, useState } from "react";
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
  const activeLogoState = animateOnScroll ? logoState : "full";
  const showDefaultLogo = activeLogoState === "partial";

  return (
    <span
      aria-hidden="true"
      className={clsx(
        "relative block h-[15px] w-[153px] overflow-visible sm:h-5 sm:w-[203px]",
        className,
      )}
    >
      <span
        className={clsx(
          "absolute inset-0 z-10 flex items-center transition-all duration-300 ease-in-out",
          showDefaultLogo
            ? "opacity-100 delay-0"
            : "opacity-0 delay-300",
        )}
      >
        <img
          src="/brand/remix-logo.svg"
          alt=""
          className="h-full w-auto"
          draggable={false}
        />
      </span>
      <span
        className={clsx(
          "absolute inset-0 z-0 flex items-center transition-all duration-300 ease-in-out",
          showDefaultLogo
            ? "translate-y-3 opacity-0 delay-300"
            : "translate-y-0 opacity-100 delay-0",
        )}
      >
        <img
          src="/brand/remix-wordmark-color.svg"
          alt=""
          className="h-full w-auto"
          draggable={false}
        />
      </span>
    </span>
  );
}

// Custom hook for how much of the logo is shown based on scroll position
function useLogoState(enableAnimation: boolean) {
  const [logoState, setLogoState] = useState<"partial" | "full">("partial");

  useEffect(() => {
    if (!enableAnimation) return;

    let throttleTimeout: NodeJS.Timeout | null = null;

    const throttle = (callback: () => void, delay: number) => {
      if (throttleTimeout !== null) return;

      throttleTimeout = setTimeout(() => {
        callback();
        throttleTimeout = null;
      }, delay);
    };

    const updateLogoState = () => {
      setLogoState(window.scrollY > 20 ? "full" : "partial");
    };

    const handleScroll = () => {
      throttle(updateLogoState, 100);
    };

    updateLogoState();
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
