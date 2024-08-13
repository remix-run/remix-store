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
      icon: ["rounded-xl px-[14px] py-3"],
      sm: ["font-bold uppercase leading-6 rounded-xl px-4 py-3"],
      lg: ["font-bold text-2xl rounded-2xl py-5 w-full"],
      fw: ["font-bold text-2xl rounded-2xl px-4 py-5 w-full"],
    },
    disabled: {
      false: [
        "active:translate-y-0.5 hover:bg-gradient-to-b hover:from-white/20 hover:to-white/20 ",
      ],
      true: [
        "shadow-none cursor-not-allowed bg-neutral-100 dark:bg-neutral-700",
      ],
    },
  },
  compoundVariants: [
    {
      intent: "primary",
      disabled: false,
      className: [
        "shadow-yamaha-primary [--yamaha-shadow-color:theme(colors.success.brand)]",
      ],
    },
    {
      intent: "secondary",
      disabled: false,
      className: "shadow-yamaha-secondary",
    },
    {
      intent: "secondary",
      size: "fw",
      className: [
        "text-black hover:text-black dark:text-white dark:hover:text-white",
      ],
    },
  ],
  defaultVariants: {
    intent: "secondary",
    size: "sm",
    disabled: false,
  },
});

const well = cva(
  ["overflow-hidden relative bg-black bg-opacity-5 dark:bg-opacity-20"],
  {
    variants: {
      size: {
        icon: "rounded-[14px] px-1 pt-[3px] pb-[7px]",
        sm: "rounded-[14px] px-1 pt-[3px] pb-[7px]",
        lg: "rounded-[18px] px-1 pt-1 pb-2",
        fw: "rounded-[20px] w-full px-1 pt-1 pb-2",
      },
      disabled: {
        true: "p-1",
      },
    },
  },
);

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
