import { Link } from "@remix-run/react";
import { cn } from "~/lib/cn";
import Icon from "~/components/icon";
import { cva, type VariantProps } from "class-variance-authority";

import type { IconName } from "~/components/icon/types.generated";

let iconVariants = cva("size-8", {
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
      className: "-ml-2.5 group-hover:ml-0 group-focus:ml-0",
    },
    {
      animate: true,
      position: "right",
      className: "-mr-2.5 group-hover:mr-0 group-focus:mr-0",
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
  children,
}: AnimatedLinkProps) {
  // Default styles for the link
  const linkClasses = cn(
    "group relative flex items-center justify-center gap-2.5 rounded-[54px] bg-white px-6 py-4 text-center text-xl font-semibold text-black no-underline",
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
    text = (
      <span className="flex gap-1">
        <span>{children}</span>
        {/* the max width is pretty arbitrary estimate */}
        <span className="max-w-0 overflow-hidden whitespace-nowrap transition-all duration-300 ease-in-out group-hover:max-w-[10ch] group-focus:max-w-[10ch]">
          {expandedText}
        </span>
      </span>
    );
  }

  return (
    <Link className={linkClasses} to={to}>
      {iconPosition === "left" && icon}
      {text}
      {iconPosition === "right" && icon}
    </Link>
  );
}
