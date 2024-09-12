// Taken from https://ui.shadcn.com/docs/components/Aside

import { createContext, useContext, useState, forwardRef } from "react";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import Icon from "~/components/icon";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "~/lib";

const AsideContext = createContext<AsideContextValue | null>(null);

const AsideProvider = ({ children }: { children: React.ReactNode }) => {
  const [type, setType] = useState<AsideType>("none");

  return (
    <AsideContext.Provider
      value={{
        type,
        open: setType,
        close: () => setType("none"),
        isOpen: type !== "none",
      }}
    >
      {children}
    </AsideContext.Provider>
  );
};
AsideProvider.displayName = "AsideProvider";

const Aside = DialogPrimitive.Root;

const AsideTrigger = DialogPrimitive.Trigger;

const AsideClose = DialogPrimitive.Close;

const AsidePortal = DialogPrimitive.Portal;

const AsideOverlay = forwardRef<
  React.ElementRef<typeof DialogPrimitive.Overlay>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Overlay>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Overlay
    className={cn(
      "data-[state=open]:fade-in-0bg-black/50 fixed inset-0 z-50 backdrop-blur-md data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0",
      className,
    )}
    {...props}
    ref={ref}
  />
));
AsideOverlay.displayName = DialogPrimitive.Overlay.displayName;

const asideVariants = cva(
  "fixed z-50 h-full w-full gap-4 overflow-hidden bg-neutral-200 transition ease-in-out data-[state=closed]:duration-300 data-[state=open]:duration-500 data-[state=open]:animate-in data-[state=closed]:animate-out sm:max-w-[var(--aside-width)] dark:bg-neutral-800",
  {
    variants: {
      side: {
        left: "inset-y-0 left-0 sm:rounded-r-3xl data-[state=closed]:slide-out-to-left data-[state=open]:slide-in-from-left ",
        right:
          "inset-y-0 right-0 sm:rounded-l-3xl data-[state=closed]:slide-out-to-right data-[state=open]:slide-in-from-right ",
      },
    },
    defaultVariants: {
      side: "right",
    },
  },
);

interface AsideContentProps
  extends React.ComponentPropsWithoutRef<typeof DialogPrimitive.Content>,
    VariantProps<typeof asideVariants> {}

const AsideContent = forwardRef<
  React.ElementRef<typeof DialogPrimitive.Content>,
  AsideContentProps
>(({ side = "right", className, children, ...props }, ref) => {
  return (
    <AsidePortal>
      <AsideOverlay />
      <DialogPrimitive.Content
        ref={ref}
        className={cn(asideVariants({ side }), className)}
        {...props}
      >
        {children}
      </DialogPrimitive.Content>
    </AsidePortal>
  );
});
AsideContent.displayName = DialogPrimitive.Content.displayName;

const AsideHeader = ({
  className,
  children,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) => (
  <div
    className={cn(
      "flex h-[var(--aside-header-height)] flex-row items-center justify-between bg-neutral-200 px-9 text-center sm:text-left dark:bg-neutral-700",
      className,
    )}
    {...props}
  >
    {children}
    <AsideClose className="m-0 rounded-sm ring-offset-neutral-200 hover:text-black focus:outline-none focus:ring-2 focus:ring-neutral-600 focus:ring-offset-2 dark:ring-offset-neutral-700 dark:hover:text-white dark:focus:ring-neutral-300">
      <Icon name="x" className="size-6" />
      <span className="sr-only">Close</span>
    </AsideClose>
  </div>
);
AsideHeader.displayName = "AsideHeader";

const AsideBody = ({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) => (
  <div
    className={cn(
      "h-[calc(100vh_-_var(--aside-header-height))] p-9",
      className,
    )}
    {...props}
  />
);
AsideBody.displayName = "AsideBody";

const AsideTitle = forwardRef<
  React.ElementRef<typeof DialogPrimitive.Title>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Title>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Title
    ref={ref}
    className={cn(
      "font-sans text-4xl tracking-[-0.36px] sm:text-5xl sm:tracking-[-0.48px]",
      className,
    )}
    {...props}
  />
));
AsideTitle.displayName = DialogPrimitive.Title.displayName;

const AsideDescription = forwardRef<
  React.ElementRef<typeof DialogPrimitive.Description>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Description>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Description ref={ref} className={className} {...props} />
));
AsideDescription.displayName = DialogPrimitive.Description.displayName;

type AsideType = "search" | "cart" | "mobile" | "none";
type AsideContextValue = {
  type: AsideType;
  open: (mode: AsideType) => void;
  close: () => void;
  isOpen: boolean;
};

const useAside = () => {
  const aside = useContext(AsideContext);
  if (!aside) {
    throw new Error("useAside must be used within an AsideProvider");
  }
  return aside;
};

export {
  AsideProvider,
  Aside,
  AsidePortal,
  AsideOverlay,
  AsideTrigger,
  AsideClose,
  AsideContent,
  AsideHeader,
  AsideBody,
  AsideTitle,
  AsideDescription,
  useAside,
};
