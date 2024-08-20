import { Slot } from "@radix-ui/react-slot";
import { forwardRef } from "react";
import { cn } from "~/lib";
import { cva, type VariantProps } from "class-variance-authority";

type ButtonVariantProps = VariantProps<typeof button>;

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  intent?: NonNullable<ButtonVariantProps["intent"]>;
  size?: NonNullable<ButtonVariantProps["size"]>;
  asChild?: boolean;
}

const button = cva(["block no-underline"], {
  variants: {
    intent: {
      primary: ["text-white hover:text-white bg-blue-brand"],
      secondary: [
        "text-neutral-600 hover:text-neutral-600",
        "dark:text-neutral-300 dark:hover:text-neutral-300",
        "bg-neutral-50 dark:bg-neutral-500",
      ],
    },
    size: {
      icon: ["rounded-xl px-[14px] py-3 flex gap-2"],
      sm: [
        "w-full rounded-xl px-5 py-3 font-bold uppercase leading-6 tracking-[0.64px]",
      ],
      lg: [
        "w-full rounded-2xl px-4 py-5 text-center text-2xl font-bold tracking-[-0.48px]",
      ],
    },
    disabled: {
      false: [
        "hover:bg-gradient-to-b hover:from-white/20 hover:to-white/20 active:translate-y-0.5",
      ],
      true: [
        "cursor-not-allowed bg-black bg-opacity-5 text-neutral-600 shadow-none dark:bg-black dark:bg-opacity-20 dark:text-neutral-300",
      ],
    },
  },
  compoundVariants: [
    {
      intent: "primary",
      disabled: false,
      className: [
        "shadow-yamaha-primary [--yamaha-shadow-color:theme(colors.blue.brand)]",
      ],
    },
    {
      intent: "secondary",
      disabled: false,
      className: [
        "shadow-yamaha-secondary text-black hover:text-black dark:text-white dark:hover:text-white",
      ],
    },
    {
      size: "sm",
      disabled: true,
      className: ["text-opacity-35 dark:text-opacity-35"],
    },
    {
      size: "lg",
      disabled: true,
      className: [""],
    },
  ],
  defaultVariants: {
    intent: "secondary",
    size: "sm",
    disabled: false,
  },
});

const well = cva(["overflow-hidden relative"], {
  variants: {
    size: {
      icon: "rounded-[14px] px-1 pt-[3px] pb-[7px] max-w-fit",
      sm: "rounded-[14px] px-1 pt-[3px] pb-[7px]",
      lg: "rounded-[20px] w-full px-1 pt-1 pb-2",
    },
    disabled: {
      false: "bg-black bg-opacity-5 dark:bg-opacity-20",
      true: "p-1",
    },
  },
});

export const Button = forwardRef(
  (
    {
      asChild,
      intent = "secondary",
      size = "sm",
      disabled = false,
      ...props
    }: ButtonProps,
    ref: React.Ref<HTMLDivElement>,
  ) => {
    const Comp = asChild ? Slot : "button";

    return (
      <div ref={ref} className={cn(well({ size, disabled }))}>
        <Comp
          {...props}
          className={cn(button({ intent, size, disabled }), props.className)}
          disabled={disabled}
        />
      </div>
    );
  },
);
Button.displayName = "Button";
