import { useRef } from "react";
import { cn } from "~/lib/cn";
import { useScrollPercentage } from "~/lib/hooks";

interface PageTitleProps {
  children: string;
  className?: string;
}

export function PageTitle({ children, className }: PageTitleProps) {
  let ref = useRef<HTMLDivElement>(null);
  let scrollPercentage = useScrollPercentage(ref);
  let translatePercent = Math.round(Math.min(scrollPercentage * 2, 1) * 80);

  return (
    <div
      ref={ref}
      className={cn(
        "relative grid h-[200px] place-items-center md:h-[360px] lg:h-[400px] xl:h-[480px] 2xl:h-[540px]",
        className,
      )}
    >
      <div className="font-title relative isolate w-full text-center text-2xl leading-[.8em] font-black tracking-[-0.23em] whitespace-nowrap uppercase select-none md:text-5xl lg:text-7xl">
        <h1 className="relative z-50 bg-black text-white select-text">
          {children}
        </h1>
        <span
          aria-hidden="true"
          className="text-pink-brand absolute inset-0 z-40 bg-black"
          style={{
            transform: `translateY(${translatePercent}%)`,
          }}
        >
          {children}
        </span>
        <span
          aria-hidden="true"
          className="text-red-brand absolute inset-0 bg-black"
          style={{
            transform: `translateY(${2 * translatePercent}%)`,
          }}
        >
          {children}
        </span>
        <span
          aria-hidden="true"
          className="text-yellow-brand absolute inset-0 z-30 bg-black"
          style={{
            transform: `translateY(${-translatePercent}%)`,
          }}
        >
          {children}
        </span>
        <span
          aria-hidden="true"
          className="text-green-brand absolute inset-0 z-20 bg-black"
          style={{
            transform: `translateY(${-2 * translatePercent}%)`,
          }}
        >
          {children}
        </span>
        <span
          aria-hidden="true"
          className="text-blue-brand absolute inset-0 z-10 bg-black"
          style={{
            transform: `translateY(${-3 * translatePercent}%)`,
          }}
        >
          {children}
        </span>
      </div>
    </div>
  );
}
