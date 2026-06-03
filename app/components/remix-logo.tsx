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
  const showMarkOnly = activeLogoState === "partial";

  const letterCss = clsx(
    "transform transition-all duration-300 ease-in-out",
    showMarkOnly
      ? "-translate-y-[140px] opacity-0"
      : "translate-y-0 opacity-100",
  );

  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 1280 126"
      fill="none"
      className={clsx(
        "block h-[15px] w-[153px] overflow-visible sm:h-5 sm:w-[203px]",
        className,
      )}
    >
      <path
        className={clsx(
          "transition-colors duration-300 ease-in-out",
          showMarkOnly ? "fill-white" : "fill-blue-brand",
        )}
        fillRule="evenodd"
        clipRule="evenodd"
        d="M237.117 0.142578L237.114 0.145508V0.148438C270.246 0.148438 293.134 15.0176 288.241 33.3604L284.926 45.7803C280.032 64.123 249.21 78.9922 216.078 78.9922H212.688L282.282 124.627H170.547L114.289 81.2012C112.037 79.7571 109.423 78.9902 106.751 78.9902H12.7041L21.5664 45.7764H186.293C192.486 45.7764 198.251 42.9954 199.167 39.5654H199.17C200.085 36.1354 195.804 33.3545 189.608 33.3545H24.8799L33.7402 0.142578H237.117ZM90.877 90.4551C93.9979 90.4551 96.2711 93.4278 95.4629 96.4561L87.9492 124.623H0.53125L9.64648 90.4551H90.877Z"
      />
      <path
        className={clsx("fill-pink-brand", letterCss)}
        d="M895.661 125.247L928.962 0.976562H1016.89L983.381 125.247H895.661Z"
      />
      <path
        className={clsx("fill-yellow-brand", letterCss)}
        d="M564.053 0.976807H848.738C886.912 0.976807 913.31 18.0335 907.624 39.1513L884.476 125.247H796.755L808.736 80.7778L815.64 55.3958L818.279 45.6491C819.904 39.3544 811.985 34.0749 800.41 34.0749H775.435C775.232 35.6994 775.232 37.3238 774.622 39.1513L751.677 125.247H663.754L675.734 80.7778L682.638 55.3958L685.278 45.6491C686.902 39.3544 678.983 34.0749 667.409 34.0749H643.042L618.472 125.247H530.752L564.053 0.976807Z"
      />
      <path
        className={clsx("fill-red-brand", letterCss)}
        fillRule="evenodd"
        clipRule="evenodd"
        d="M1147.53 21.5391L1177.72 1.72852H1279.7L1187.2 62.4297L1247.28 124.354H1145.3L1124.89 103.32L1092.84 124.354H990.856L1085.22 62.4297L1026.33 1.72852H1128.31L1147.53 21.5391Z"
      />
      <path
        className={clsx("fill-green-brand", letterCss)}
        fillRule="evenodd"
        clipRule="evenodd"
        d="M545.101 34.0745H403.164C403.031 34.0745 402.898 34.0759 402.765 34.0774H382.405L379.167 46.4348H379.211L379.205 46.4612H541.649L532.917 79.762H370.27L370.067 80.7776C368.24 87.0722 376.159 92.1487 387.733 92.1487H529.465L520.532 125.246H339.406C301.231 125.246 274.833 108.189 280.519 87.2747L293.312 39.1506C293.598 38.0866 293.961 37.0332 294.396 35.9915L303.571 0.976807H372.569C372.615 0.976757 372.661 0.97583 372.706 0.97583H553.832L545.101 34.0745Z"
      />
    </svg>
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
