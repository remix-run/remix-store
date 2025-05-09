import { Link, type LinkProps } from "react-router";
import { cn } from "~/lib/cn";
import { Icon } from "~/components/icon";
import { cva, type VariantProps } from "class-variance-authority";

import type { IconName } from "~/components/icon/types.generated";

let iconVariants = cva("size-6 md:size-8", {
  variants: {
    animate: {
      true: "icon-animation max-w-0 scale-75 opacity-0 group-hover:max-w-[32px] group-focus:max-w-[32px] group-hover:scale-100 group-focus:scale-100 group-hover:opacity-100 group-focus:opacity-100 ",
      false: "max-w-[32px] scale-100 opacity-100",
    },
    position: {
      left: "",
      right: "",
    },
  },
  compoundVariants: [
    {
      animate: true,
      position: "left",
      className: "-ml-2 md:-ml-2.5 group-hover:ml-0 group-focus:ml-0",
    },
    {
      animate: true,
      position: "right",
      className: "-mr-2 md:-mr-2.5 group-hover:mr-0 group-focus:mr-0",
    },
  ],
  defaultVariants: {
    position: "left",
    animate: true,
  },
});

type IconVariants = VariantProps<typeof iconVariants>;

type BaseAnimatedLinkProps = {
  to: string;
  children: React.ReactNode;
  className?: string;
  prefetch?: LinkProps["prefetch"];
};

export type AnimatedLinkProps = BaseAnimatedLinkProps &
  (
    | {
        animationType?: "icon";
        iconName: IconName;
        expandedText?: never;
        iconPosition?: IconVariants["position"];
      }
    | {
        animationType?: "text";
        iconName?: IconName;
        expandedText: string;
        iconPosition?: IconVariants["position"];
      }
    | {
        animationType?: "both";
        iconName: IconName;
        expandedText: string;
        iconPosition?: IconVariants["position"];
      }
  );

export function AnimatedLink({
  to,
  className,
  animationType = "icon",
  iconName,
  expandedText,
  iconPosition = "left",
  prefetch,
  children,
}: AnimatedLinkProps) {
  // Default styles for the link
  let linkClasses = cn(
    "group relative flex h-12 items-center justify-center gap-2 rounded-[54px] bg-white px-5 py-2 text-center text-base font-semibold text-black no-underline md:h-16 md:gap-2.5 md:px-6 md:py-4 md:text-xl",
    className,
  );

  // Create the icon if there is one, adding animation if needed
  let icon: React.ReactNode = null;
  if (iconName) {
    icon = (
      <Icon
        name={iconName}
        className={iconVariants({
          animate: animationType === "both" || animationType === "icon",
          position: iconPosition,
        })}
        fill="currentColor"
        aria-hidden="true"
      />
    );
  }

  // Add the animation to the expanded text if needed
  let text = children;
  if (animationType === "both" || animationType === "text") {
    // Add padding to the link to account for the animation of the text
    linkClasses = cn(linkClasses, "pl-5 pr-4 md:pl-6 md:pr-5");
    text = (
      <span className="flex gap-1">
        <span>{children}</span>
        {/* the max width is pretty arbitrary estimate */}
        <span className="max-w-0 overflow-hidden pr-0 whitespace-nowrap transition-all duration-300 ease-in-out group-hover:max-w-[10ch] group-hover:pr-1 group-focus-visible:max-w-[10ch] group-focus-visible:pr-1">
          {expandedText}
        </span>
      </span>
    );
  }

  return (
    <Link className={linkClasses} to={to} prefetch={prefetch}>
      {iconPosition === "left" && icon}
      {text}
      {iconPosition === "right" && icon}
    </Link>
  );
}

// Accounting for every possible link type is pretty difficult, might want to refactor the components in this file and document them a bit better at some point
export function AnimatedLinkSpread({
  to,
  disabled = false,
  className,
  onClick,
  children,
  ...props
}: {
  disabled?: boolean;
} & LinkProps) {
  return (
    <Link
      to={to}
      className={cn(
        "group flex w-full items-center justify-center rounded-[54px] bg-white px-6 py-4 text-xl font-semibold text-black no-underline outline-none ring-inset",
        disabled
          ? "cursor-not-allowed bg-white/70 text-black/60"
          : "hover:bg-blue-brand focus-visible:bg-blue-brand transition-colors duration-300 hover:text-white hover:ring hover:ring-white focus-visible:text-white focus-visible:ring focus-visible:ring-white",
        className,
      )}
      aria-disabled={disabled}
      onClick={(e) => {
        if (disabled) {
          e.preventDefault();
          return;
        }
        if (onClick) {
          onClick(e);
        }
      }}
      {...props}
    >
      <div
        className={cn(
          "flex h-8 w-0 min-w-fit items-center justify-between gap-2.5 transition-[width] duration-300 ease-in-out",
          !disabled && "group-hover:w-full group-focus-visible:w-full",
        )}
      >
        {children}
      </div>
    </Link>
  );
}
