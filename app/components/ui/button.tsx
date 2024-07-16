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

const button = cva(["block leading-6", "active:translate-y-0.5"], {
  variants: {
    intent: {
      primary:
        "text-white bg-success-brand dark:bg-success-brand bg-opacity-100 shadow-yamaha-blue",
      secondary:
        "text-neutral-600 dark:text-neutral-300 bg-neutral-50 dark:bg-neutral-500 dark:hover:bg-neutral-400 hover:bg-neutral-100 bg-opacity-5 dark:bg-opacity-100 shadow-yamaha-grey-light dark:shadow-yamaha-grey",
    },
    size: {
      icon: ["rounded-[12px] px-[14px] py-3"],
      sm: ["font-bold uppercase leading-6", "rounded-[12px] px-4 py-3"],
      lg: ["font-bold leading-[29px] text-2xl", "rounded-[16px] py-5 w-full"],
      fw: ["font-bold rounded-[12px] px-4 py-3 w-full"],
    },
  },
  defaultVariants: {
    intent: "secondary",
    size: "sm",
  },
});

const well = cva(
  [
    "overflow-hidden relative rounded-[14px] bg-neutral-800 bg-opacity-5 dark:bg-opacity-15 px-[2px] pt-[2px] pb-[7px]",
  ],
  {
    variants: {
      size: {
        lg: "rounded-[18px]",
        sm: "rounded-[14px]",
        icon: "rounded-[14px]",
        fw: "rounded-[14px] w-full",
      },
    },
  },
);

export const Button = forwardRef(function Button(
  { asChild, intent = "secondary", size = "sm", ...props }: ButtonProps,
  ref: React.Ref<HTMLDivElement>,
) {
  const Comp = asChild ? Slot : "button";

  return (
    <div ref={ref} className={well({ size })}>
      <Comp
        {...props}
        className={cn(button({ intent, size }), props.className)}
      />
    </div>
  );
});
