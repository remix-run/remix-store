import * as React from "react";
import * as AccordionPrimitive from "@radix-ui/react-accordion";
import Icon from "~/components/icon";
import { cn } from "~/lib/cn";
import { cva } from "class-variance-authority";

import type { VariantProps } from "class-variance-authority";

const Accordion = React.forwardRef<
  React.ElementRef<typeof AccordionPrimitive.Root>,
  React.ComponentPropsWithoutRef<typeof AccordionPrimitive.Root>
>(({ className, ...props }, ref) => (
  <AccordionPrimitive.Root
    className={cn("flex flex-col gap-6", className)}
    ref={ref}
    {...props}
  />
));
Accordion.displayName = "Accordion";

const AccordionItem = React.forwardRef<
  React.ElementRef<typeof AccordionPrimitive.Item>,
  React.ComponentPropsWithoutRef<typeof AccordionPrimitive.Item>
>(({ className, ...props }, ref) => (
  <AccordionPrimitive.Item
    ref={ref}
    className={cn("pb-3", className)}
    {...props}
  />
));
AccordionItem.displayName = "AccordionItem";

const accordionTriggerVariants = cva(
  "flex flex-1 items-center justify-between rounded-2xl p-4 md:p-6 font-medium transition-all hover:bg-neutral-50 dark:hover:bg-neutral-500",
  {
    variants: {
      icon: {
        x: "[&[data-state=closed]>svg]:-rotate-45",
        "chevron-up": "[&[data-state=closed]>svg]:rotate-180",
      },
    },
  },
);

type Icon = NonNullable<VariantProps<typeof accordionTriggerVariants>["icon"]>;

const AccordionTrigger = React.forwardRef<
  React.ElementRef<typeof AccordionPrimitive.Trigger>,
  React.ComponentPropsWithoutRef<typeof AccordionPrimitive.Trigger> & {
    icon?: Icon;
  }
>(({ className, children, icon = "x", ...props }, ref) => (
  <AccordionPrimitive.Header
    className="flex text-xl leading-4 font-medium tracking-normal md:text-2xl"
    asChild
  >
    {/* Note: h2 is probably not right in all cases, probably should make configurable */}
    <h2>
      <AccordionPrimitive.Trigger
        ref={ref}
        className={cn(accordionTriggerVariants({ icon }), className)}
        {...props}
      >
        {children}
        <Icon
          name={icon}
          className="h-6 w-6 shrink-0 transition-transform duration-200"
        />
      </AccordionPrimitive.Trigger>
    </h2>
  </AccordionPrimitive.Header>
));
AccordionTrigger.displayName = AccordionPrimitive.Trigger.displayName;

const AccordionContent = React.forwardRef<
  React.ElementRef<typeof AccordionPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof AccordionPrimitive.Content>
>(({ className, children, ...props }, ref) => (
  <AccordionPrimitive.Content
    ref={ref}
    className="data-[state=closed]:animate-accordion-up data-[state=open]:animate-accordion-down overflow-hidden px-4 transition-all md:px-6"
    {...props}
  >
    <div className={cn("mt-6", className)}>{children}</div>
  </AccordionPrimitive.Content>
));

AccordionContent.displayName = AccordionPrimitive.Content.displayName;

export { Accordion, AccordionItem, AccordionTrigger, AccordionContent };
